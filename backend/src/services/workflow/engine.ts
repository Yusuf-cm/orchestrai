import { v4 as uuidv4 } from 'uuid';
import type { CaseData, WorkflowDefinition, WorkflowStep } from '@waypoint/shared';
import { getWorkflow, getWorkflowStep } from './loader';
import { getMatchingTransition } from './conditions';
import { getAdapter } from '../../adapters/registry';
import { logAudit } from '../audit';
import { requiresUserConfirmation } from '../execution';

export interface AdvanceResult {
  allowed: boolean;
  reason?: string;
  case: CaseData;
  message?: string;
}

/** Steps whose mode means the system must stop and wait for the person. */
function isWaitingOnUser(step: WorkflowStep): boolean {
  return requiresUserConfirmation(step);
}

function recalculateReadiness(caseData: CaseData): CaseData {
  const adapter = getAdapter(caseData.adapterId);
  if (!adapter) return caseData;
  const readiness = adapter.calculateReadiness(caseData);
  return {
    ...caseData,
    state: {
      ...caseData.state,
      readinessScore: readiness.score,
      readinessStatus: readiness.status,
      blockers: readiness.blockers,
    },
  };
}

/**
 * Runs the handler attached to the current step, if any. Handlers are the only
 * way adapter/domain logic can influence case data, and they return data rather
 * than mutating the case directly.
 */
export async function runStepHandler(caseData: CaseData): Promise<CaseData> {
  const workflow = getWorkflow(caseData.workflow.definitionId);
  if (!workflow) return caseData;

  const step = getWorkflowStep(workflow, caseData.workflow.currentStepId);
  if (!step?.handler) return caseData;

  const adapter = getAdapter(caseData.adapterId);
  const handler = adapter?.handlers[step.handler];
  if (!adapter || !handler) return caseData;

  const result = await handler(caseData, step);
  if (!result.success) {
    await logAudit({
      caseId: caseData.id,
      actor: 'system',
      action: 'step_handler_failed',
      stepId: step.id,
      output: { error: result.error },
      success: false,
    });
    return caseData;
  }

  let updated: CaseData = { ...caseData };
  if (result.requirements) updated.requirements = result.requirements;
  if (result.output) {
    updated.workflow = {
      ...updated.workflow,
      slots: { ...updated.workflow.slots, ...result.output },
    };
  }
  if (result.flags?.length) {
    updated.state = {
      ...updated.state,
      flags: [...new Set([...updated.state.flags, ...result.flags])],
    };
  }

  return recalculateReadiness(updated);
}

/**
 * Attempts a single deterministic transition. The engine is the only writer of
 * workflow position: callers describe what happened, the engine decides whether
 * the case may move and where.
 */
export async function tryAdvance(
  caseData: CaseData,
  trigger: string = 'auto'
): Promise<AdvanceResult> {
  const workflow = getWorkflow(caseData.workflow.definitionId);
  if (!workflow) {
    return { allowed: false, reason: 'Workflow definition not found', case: caseData };
  }

  const current = await runStepHandler(caseData);
  const step = getWorkflowStep(workflow, current.workflow.currentStepId);
  if (!step) {
    return { allowed: false, reason: 'Current step not found in workflow', case: current };
  }

  const nextStepId = getMatchingTransition(step.transitions, current);
  if (!nextStepId) {
    return { allowed: false, reason: 'No transition is satisfied yet', case: current };
  }
  if (nextStepId === step.id) {
    return { allowed: false, reason: 'Already at this step', case: current };
  }

  const nextStep = getWorkflowStep(workflow, nextStepId);
  const nextIndex = workflow.steps.findIndex((s) => s.id === nextStepId);
  const isTerminal = (nextStep?.transitions ?? []).length === 0;

  let updated: CaseData = {
    ...current,
    workflow: {
      ...current.workflow,
      currentStepId: nextStepId,
      currentStepIndex: nextIndex,
      completedSteps: [...new Set([...current.workflow.completedSteps, step.id])],
      status: isTerminal ? 'completed' : 'active',
      // A confirmation authorises exactly one transition. Clearing it here stops
      // a single click from cascading through several steps.
      slots: { ...current.workflow.slots, _user_confirmed: false },
    },
    status: isTerminal ? 'resolved' : current.status === 'open' ? 'in_progress' : current.status,
    updatedAt: new Date().toISOString(),
  };

  if (nextStep) {
    updated.state = { ...updated.state, phase: phaseForStep(nextStep, isTerminal) };
  }

  updated = recalculateReadiness(updated);

  await logAudit({
    caseId: updated.id,
    actor: trigger === 'user_confirms' ? 'user' : 'system',
    action: 'workflow_advanced',
    stepId: nextStepId,
    input: { from: step.id, trigger },
    success: true,
  });

  const afterHandler = await runStepHandler(updated);
  return { allowed: true, case: afterHandler, message: `Advanced to ${nextStepId}` };
}

function phaseForStep(step: WorkflowStep, isTerminal: boolean): CaseData['state']['phase'] {
  if (isTerminal) return 'resolved';
  switch (step.type) {
    case 'collect_input':
    case 'ask_question':
      return 'intake';
    case 'document_required':
    case 'assist_user':
      return 'preparation';
    case 'guide_user':
    case 'appointment':
    case 'payment':
      return 'action';
    case 'human_handoff':
      return 'followup';
    default:
      return 'preparation';
  }
}

/**
 * Advances as far as the case legitimately can without user input, stopping at
 * the first step that needs a person. Handler-driven steps (lookups,
 * validations) run automatically; guide/collect/appointment steps do not.
 */
export async function advanceUntilUserInput(
  caseData: CaseData,
  trigger: string = 'auto',
  maxSteps = 12
): Promise<CaseData> {
  const workflow = getWorkflow(caseData.workflow.definitionId);
  if (!workflow) return caseData;

  let current = await runStepHandler(caseData);

  for (let i = 0; i < maxSteps; i++) {
    const step = getWorkflowStep(workflow, current.workflow.currentStepId);
    if (!step) break;
    if (isWaitingOnUser(step) && i > 0) break;

    const result = await tryAdvance(current, i === 0 ? trigger : 'auto');
    if (!result.allowed) {
      current = result.case;
      break;
    }
    current = result.case;

    const newStep = getWorkflowStep(workflow, current.workflow.currentStepId);
    if (!newStep || isWaitingOnUser(newStep) || newStep.transitions.length === 0) break;
  }

  return current;
}

export function createInitialCase(
  workflow: WorkflowDefinition,
  params: {
    userId: string;
    title: string;
    intent: CaseData['intent'];
    adapterId: string;
    institution: CaseData['institution'];
    service?: CaseData['service'];
    slots?: Record<string, unknown>;
  }
): CaseData {
  const firstStep = workflow.steps[0];
  return {
    id: uuidv4(),
    userId: params.userId,
    title: params.title,
    domain: workflow.domain,
    adapterId: params.adapterId,
    institution: params.institution,
    service: params.service,
    intent: params.intent,
    workflow: {
      definitionId: workflow.id,
      definitionVersion: workflow.version,
      currentStepId: firstStep.id,
      currentStepIndex: 0,
      status: 'active',
      completedSteps: [],
      slots: params.slots ?? {},
    },
    state: {
      phase: 'intake',
      readinessScore: 0,
      readinessStatus: 'not_ready',
      blockers: [],
      flags: [],
    },
    requirements: [],
    artifacts: [],
    appointments: [],
    tasks: [],
    evidence: [],
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getCurrentStepInfo(caseData: CaseData): WorkflowStep | null {
  const workflow = getWorkflow(caseData.workflow.definitionId);
  if (!workflow) return null;
  return getWorkflowStep(workflow, caseData.workflow.currentStepId);
}
