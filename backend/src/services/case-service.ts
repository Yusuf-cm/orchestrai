import { v4 as uuidv4 } from 'uuid';
import type { CaseData } from '@waypoint/shared';
import { classifyIntentAcrossAdapters, getAdapter } from '../adapters/registry';
import { classifyIntentWithAI } from './orchestrator';
import { createInitialCase, tryAdvance, getCurrentStepInfo } from './workflow/engine';
import { saveCase, getCaseById } from './case-store';
import { logAudit } from './audit';
import { scheduleAppointment } from '../adapters/healthcare';

const DEMO_USER_ID = 'demo-user';

const SLOT_DEFAULTS: Record<string, Record<string, unknown>> = {
  'gov.id_replacement': {
    state: 'CA',
    id_type: 'drivers_license',
    is_us_citizen: true,
    zip_code: '90048',
  },
  'health.find_care': {
    symptom_description: '',
    duration_weeks: 3,
    severity_1_10: 5,
    insurance_carrier: 'Blue Cross',
    zip_code: '90017',
  },
};

export async function startCase(utterance: string, userId = DEMO_USER_ID): Promise<CaseData> {
  const aiResult = await classifyIntentWithAI(utterance);
  const adapterMatch = classifyIntentAcrossAdapters(utterance);

  const adapter = adapterMatch?.adapter ?? getAdapter(aiResult.domain === 'healthcare' ? 'health-adapter-v1' : 'gov-adapter-v1');
  if (!adapter) throw new Error('No adapter found');

  const intent = aiResult.confidence > 0.3 ? aiResult.classifiedIntent : adapterMatch?.result.classifiedIntent ?? 'unknown';
  const entities = { ...adapterMatch?.result.extractedEntities, ...aiResult.extractedEntities };

  const slots = {
    ...SLOT_DEFAULTS[intent],
    ...entities,
    symptom_description: entities.symptom_description ?? (intent === 'health.find_care' ? utterance : undefined),
  };

  const workflow = adapter.resolveWorkflow(intent, slots);
  if (!workflow) throw new Error(`No workflow for intent: ${intent}`);

  const institution = adapter.resolveInstitution(slots);
  const title =
    intent === 'gov.id_replacement'
      ? 'Replace Lost California Driver\'s License'
      : intent === 'health.find_care'
        ? 'Find Care for Joint Pain'
        : 'New Case';

  const USER_FACING_STEPS = new Set([
    'collect_documents', 'not_ready_brief', 'schedule_visit', 'select_provider',
    'schedule_appointment', 'appointment_reminder', 'post_visit_followup',
    'emergency_redirect', 'resolved', 'visit_complete',
  ]);

  let caseData = createInitialCase(workflow, {
    userId,
    title,
    intent: {
      rawUtterance: utterance,
      classifiedIntent: intent,
      confidence: aiResult.confidence,
      extractedEntities: entities,
      clarifications: [],
    },
    adapterId: adapter.id,
    institution,
    service: institution.id === 'dmv-ca' ? { id: 'id-replacement', name: 'Replace Lost ID' } : undefined,
    slots: slots as Record<string, unknown>,
  });

  caseData = await saveCase(caseData);

  await logAudit({
    caseId: caseData.id,
    actor: 'ai',
    action: 'case_created',
    input: { utterance, intent },
    success: true,
  });

  let current = caseData;
  for (let i = 0; i < 10; i++) {
    const result = await tryAdvance(current, 'auto');
    if (!result.allowed) break;
    current = result.case;
    if (USER_FACING_STEPS.has(current.workflow.currentStepId)) break;
  }

  return saveCase(current);
}

export async function updateCase(
  caseId: string,
  updates: {
    slots?: Record<string, unknown>;
    confirmStep?: boolean;
    satisfyRequirement?: string;
    selectProvider?: string;
    scheduleAppointment?: { providerId: string; datetime: string };
  }
): Promise<CaseData> {
  let caseData = await getCaseById(caseId);
  if (!caseData) throw new Error('Case not found');

  const adapter = getAdapter(caseData.adapterId);
  if (!adapter) throw new Error('Adapter not found');

  if (updates.slots) {
    caseData.workflow.slots = { ...caseData.workflow.slots, ...updates.slots };
  }

  if (updates.satisfyRequirement) {
    caseData.requirements = caseData.requirements.map((r) =>
      r.id === updates.satisfyRequirement ? { ...r, status: 'satisfied' } : r
    );
  }

  if (updates.selectProvider) {
    caseData.workflow.slots.selected_provider_id = updates.selectProvider;
    caseData.requirements = caseData.requirements.map((r) =>
      r.id === 'req_insurance_card' || r.id === 'req_photo_id'
        ? { ...r, status: 'satisfied' as const }
        : r
    );
  }

  if (updates.scheduleAppointment) {
    caseData = scheduleAppointment(
      caseData,
      updates.scheduleAppointment.providerId,
      updates.scheduleAppointment.datetime
    );
  }

  if (updates.confirmStep) {
    caseData.workflow.slots._user_confirmed = true;
  }

  const readiness = adapter.calculateReadiness(caseData);
  caseData.state = {
    ...caseData.state,
    readinessScore: readiness.score,
    readinessStatus: readiness.status,
    blockers: readiness.blockers,
  };

  caseData = (await saveCase(caseData))!;

  if (updates.confirmStep || updates.satisfyRequirement || updates.selectProvider || updates.scheduleAppointment) {
    const advanced = await tryAdvance(caseData, updates.confirmStep ? 'user_confirms' : 'auto');
    caseData = await saveCase(advanced.case);
    if (advanced.allowed && caseData.workflow.currentStepId !== 'collect_documents') {
      const adv2 = await tryAdvance(caseData, 'auto');
      if (adv2.allowed) caseData = await saveCase(adv2.case);
    }
  }

  return caseData;
}

export async function uploadArtifact(
  caseId: string,
  file: { originalname: string; path: string },
  requirementId?: string
): Promise<CaseData> {
  let caseData = await getCaseById(caseId);
  if (!caseData) throw new Error('Case not found');

  const name = file.originalname.toLowerCase();
  const extractedFields: Record<string, unknown> = {};
  let matchedReqId = requirementId;

  if (name.includes('passport') || name.includes('birth')) {
    matchedReqId = matchedReqId ?? 'req_primary_id';
    extractedFields.documentType = name.includes('passport') ? 'passport' : 'birth_certificate';
    extractedFields.name = 'Alex Johnson';
  } else if (name.includes('utility') || name.includes('bill')) {
    matchedReqId = matchedReqId ?? caseData.requirements.find((r) => r.id.startsWith('req_residency') && r.status !== 'satisfied')?.id;
    extractedFields.documentType = 'utility_bill';
    extractedFields.address = '123 Main St, Los Angeles, CA 90048';
  } else if (name.includes('bank') || name.includes('statement')) {
    matchedReqId = matchedReqId ?? caseData.requirements.find((r) => r.id.startsWith('req_residency') && r.status !== 'satisfied')?.id;
    extractedFields.documentType = 'bank_statement';
  }

  const artifact = {
    id: uuidv4(),
    type: 'upload' as const,
    name: file.originalname,
    storageRef: file.path,
    extractedFields,
    validationStatus: 'valid' as const,
    requirementId: matchedReqId,
    uploadedAt: new Date().toISOString(),
  };

  caseData.artifacts = [...caseData.artifacts, artifact];

  if (matchedReqId) {
    caseData.requirements = caseData.requirements.map((r) =>
      r.id === matchedReqId ? { ...r, status: 'satisfied' as const, satisfiedBy: artifact.id } : r
    );
  }

  const adapter = getAdapter(caseData.adapterId)!;
  const readiness = adapter.calculateReadiness(caseData);
  caseData.state = {
    ...caseData.state,
    readinessScore: readiness.score,
    readinessStatus: readiness.status,
    blockers: readiness.blockers,
  };

  await logAudit({
    caseId,
    actor: 'user',
    action: 'artifact_uploaded',
    input: { filename: file.originalname, requirementId: matchedReqId },
    success: true,
  });

  caseData = await saveCase(caseData);

  const advanced = await tryAdvance(caseData, 'auto');
  return saveCase(advanced.case);
}

export { getCurrentStepInfo };
