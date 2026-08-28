import { v4 as uuidv4 } from 'uuid';
import type { CaseData, CaseView, Requirement } from '@waypoint/shared';
import { classifyIntentAcrossAdapters, getAdapter, getAdapterByDomain } from '../adapters/registry';
import { classifyIntentWithAI } from './orchestrator';
import {
  advanceUntilUserInput,
  createInitialCase,
  getCurrentStepInfo,
  recalculateReadiness,
} from './workflow/engine';
import { getCaseById, listCases, saveCase } from './case-store';
import { getAuditEvents, logAudit } from './audit';
import { planExecution } from './execution';
import { selectFacility, scheduleVisit } from '../adapters/healthcare';

export const DEMO_USER_ID = 'demo-user';

export class UnsupportedRequestError extends Error {}
export class CaseNotFoundError extends Error {}

/**
 * Turns a sentence into a case. Intent classification is advisory; the adapter
 * decides which workflow applies, and the engine decides where the case starts.
 */
export async function startCase(utterance: string, userId = DEMO_USER_ID): Promise<CaseView> {
  const aiResult = await classifyIntentWithAI(utterance);
  const adapterMatch = classifyIntentAcrossAdapters(utterance);

  // Prefer whichever source is more confident, then fall back to the adapter
  // registered for the AI's chosen domain.
  const useAi =
    aiResult.classifiedIntent !== 'unknown' &&
    aiResult.confidence >= (adapterMatch?.result.confidence ?? 0);

  const intent = useAi ? aiResult.classifiedIntent : adapterMatch?.result.classifiedIntent;
  const adapter = useAi
    ? getAdapterByDomain(aiResult.domain) ?? adapterMatch?.adapter ?? null
    : adapterMatch?.adapter ?? null;

  if (!adapter || !intent || intent === 'unknown') {
    throw new UnsupportedRequestError(
      'Waypoint does not handle that yet. It currently covers replacing a lost national ID and finding the right level of health care.'
    );
  }

  const entities = {
    ...(adapterMatch?.result.extractedEntities ?? {}),
    ...aiResult.extractedEntities,
  };

  const slots: Record<string, unknown> = {
    ...adapter.getDefaultSlots(intent),
    ...entities,
  };

  const workflow = adapter.resolveWorkflow(intent, slots);
  if (!workflow) {
    throw new UnsupportedRequestError(`No workflow is registered for ${intent}`);
  }

  let caseData = createInitialCase(workflow, {
    userId,
    title: adapter.getCaseTitle(intent, slots),
    intent: {
      rawUtterance: utterance,
      classifiedIntent: intent,
      confidence: useAi ? aiResult.confidence : adapterMatch?.result.confidence ?? 0,
      extractedEntities: entities,
      clarifications: [],
    },
    adapterId: adapter.id,
    institution: adapter.resolveInstitution(slots),
    service: { id: workflow.id, name: workflow.title },
    slots,
  });

  caseData = await saveCase(caseData);

  await logAudit({
    caseId: caseData.id,
    actor: 'ai',
    action: 'case_created',
    input: { utterance, intent, confidence: caseData.intent.confidence },
  });

  caseData = await advanceUntilUserInput(caseData);
  return toCaseView(await saveCase(caseData));
}

export interface CaseUpdate {
  slots?: Record<string, unknown>;
  confirmStep?: boolean;
  satisfyRequirement?: string;
  unsatisfyRequirement?: string;
  selectFacility?: string;
  scheduleVisit?: { facilityId: string; datetime: string };
  grantExecution?: string;
}

/**
 * Applies a described change, then asks the engine whether the case may move.
 * Every branch here records what happened rather than deciding the next step.
 */
export async function updateCase(caseId: string, updates: CaseUpdate): Promise<CaseView> {
  let caseData = await getCaseById(caseId);
  if (!caseData) throw new CaseNotFoundError('Case not found');

  const adapter = getAdapter(caseData.adapterId);
  if (!adapter) throw new Error(`Adapter ${caseData.adapterId} is not registered`);

  if (updates.slots) {
    caseData.workflow.slots = { ...caseData.workflow.slots, ...updates.slots };
  }

  if (updates.satisfyRequirement) {
    caseData = setRequirementStatus(caseData, updates.satisfyRequirement, 'satisfied');
  }

  if (updates.unsatisfyRequirement) {
    caseData = setRequirementStatus(caseData, updates.unsatisfyRequirement, 'needed');
  }

  if (updates.selectFacility) {
    caseData = selectFacility(caseData, updates.selectFacility);
  }

  if (updates.grantExecution) {
    const grants = (caseData.workflow.slots._execution_grants as string[]) ?? [];
    caseData.workflow.slots._execution_grants = [
      ...new Set([...grants, updates.grantExecution]),
    ];
  }

  if (updates.scheduleVisit) {
    const step = getCurrentStepInfo(caseData);
    if (step) {
      // An appointment changes state outside Waypoint, so it needs authorisation.
      const grants = (caseData.workflow.slots._execution_grants as string[]) ?? [];
      caseData.workflow.slots._execution_grants = [...new Set([...grants, step.id])];
    }
    caseData = scheduleVisit(
      caseData,
      updates.scheduleVisit.facilityId,
      updates.scheduleVisit.datetime
    );
  }

  if (updates.confirmStep) {
    const step = getCurrentStepInfo(caseData);
    if (step) {
      const plan = planExecution(step, caseData);
      if (plan.mode === 'escalate') {
        throw new UnsupportedRequestError(
          'This step has been handed to a person and cannot be advanced automatically.'
        );
      }
    }
    caseData.workflow.slots._user_confirmed = true;
  }

  caseData = await saveCase(recalculateReadiness(caseData));

  const trigger = updates.confirmStep ? 'user_confirms' : 'auto';
  caseData = await advanceUntilUserInput(caseData, trigger);

  // A confirmation authorises one transition only.
  if (caseData.workflow.slots._user_confirmed) {
    caseData.workflow.slots._user_confirmed = false;
  }

  return toCaseView(await saveCase(caseData));
}

function setRequirementStatus(
  caseData: CaseData,
  requirementId: string,
  status: Requirement['status']
): CaseData {
  return {
    ...caseData,
    requirements: caseData.requirements.map((r) =>
      r.id === requirementId ? { ...r, status } : r
    ),
  };
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

export class InvalidUploadError extends Error {}

export async function uploadArtifact(
  caseId: string,
  file: { originalname: string; path: string; mimetype: string; size: number },
  requirementId?: string
): Promise<CaseView> {
  let caseData = await getCaseById(caseId);
  if (!caseData) throw new CaseNotFoundError('Case not found');

  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new InvalidUploadError('Upload a photo (JPEG, PNG, WebP, HEIC) or a PDF.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new InvalidUploadError('Files must be under 10 MB.');
  }

  const target =
    requirementId ??
    caseData.requirements.find((r) => r.category === 'document' && r.status !== 'satisfied')?.id;

  const artifact = {
    id: uuidv4(),
    type: 'upload' as const,
    name: file.originalname,
    storageRef: file.path,
    validationStatus: 'valid' as const,
    requirementId: target,
    uploadedAt: new Date().toISOString(),
  };

  caseData.artifacts = [...caseData.artifacts, artifact];
  if (target) {
    caseData = setRequirementStatus(caseData, target, 'satisfied');
  }

  await logAudit({
    caseId,
    actor: 'user',
    action: 'document_attached',
    input: { filename: file.originalname, requirementId: target },
  });

  caseData = await saveCase(recalculateReadiness(caseData));
  caseData = await advanceUntilUserInput(caseData);
  return toCaseView(await saveCase(caseData));
}

/**
 * Shapes a case for the client. The current step and its execution plan travel
 * with the case so the interface can render any workflow without knowing step
 * names in advance.
 */
export function toCaseView(caseData: CaseData): CaseView {
  const step = getCurrentStepInfo(caseData);
  const adapter = getAdapter(caseData.adapterId);

  return {
    ...caseData,
    currentStep: step
      ? {
          id: step.id,
          type: step.type,
          mode: step.mode,
          title: step.title ?? 'Next step',
          description: step.description,
          isTerminal: (step.transitions ?? []).length === 0,
          execution: planExecution(step, caseData),
        }
      : null,
    evidence: collectEvidence(caseData, adapter),
  };
}

function collectEvidence(caseData: CaseData, adapter: ReturnType<typeof getAdapter>) {
  if (!adapter) return caseData.evidence;
  const seen = new Map<string, CaseData['evidence'][number]>();
  for (const req of caseData.requirements) {
    for (const evidence of adapter.getEvidence(req.id)) {
      seen.set(evidence.id, evidence);
    }
  }
  return Array.from(seen.values());
}

export async function getCaseView(caseId: string, userId: string): Promise<CaseView | null> {
  const caseData = await getCaseById(caseId);
  if (!caseData) return null;
  if (caseData.userId !== userId) return null;
  const view = toCaseView(caseData);
  return { ...view, audit: await getAuditEvents(caseId) };
}

export async function listCaseViews(userId: string, status?: string): Promise<CaseView[]> {
  const cases = await listCases(userId, status);
  return cases.map(toCaseView);
}

export { getCurrentStepInfo };
