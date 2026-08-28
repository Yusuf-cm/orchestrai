import { v4 as uuidv4 } from 'uuid';
import type { CaseData, WorkflowDefinition } from '@waypoint/shared';
import { getWorkflow, getWorkflowStep } from './loader';
import { getMatchingTransition } from './conditions';
import { getAdapter } from '../../adapters/registry';
import { logAudit } from '../audit';

export interface AdvanceResult {
  allowed: boolean;
  reason?: string;
  case: CaseData;
  message?: string;
}

export async function runStepHandler(caseData: CaseData): Promise<CaseData> {
  const workflow = getWorkflow(caseData.workflow.definitionId);
  if (!workflow) return caseData;

  const step = getWorkflowStep(workflow, caseData.workflow.currentStepId);
  if (!step?.handler) return caseData;

  const adapter = getAdapter(caseData.adapterId);
  if (!adapter) return caseData;

  const handler = adapter.handlers[step.handler];
  if (!handler) return caseData;

  const result = await handler(caseData, step);
  if (!result.success) return caseData;

  let updated = { ...caseData };
  if (result.requirements) {
    updated.requirements = result.requirements;
  }
  if (result.output) {
    updated.workflow = {
      ...updated.workflow,
      slots: { ...updated.workflow.slots, ...result.output },
    };
  }
  if (result.blockers) {
    updated.state = { ...updated.state, blockers: result.blockers };
  }
  if (result.flags) {
    updated.state = {
      ...updated.state,
      flags: [...new Set([...updated.state.flags, ...result.flags])],
    };
  }

  const readiness = adapter.calculateReadiness(updated);
  updated.state = {
    ...updated.state,
    readinessScore: readiness.score,
    readinessStatus: readiness.status,
    blockers: readiness.blockers,
  };

  return updated;
}

export async function tryAdvance(
  caseData: CaseData,
  trigger: string = 'auto'
): Promise<AdvanceResult> {
  const workflow = getWorkflow(caseData.workflow.definitionId);
  if (!workflow) {
    return { allowed: false, reason: 'Workflow not found', case: caseData };
  }

  let current = await runStepHandler(caseData);
  const step = getWorkflowStep(workflow, current.workflow.currentStepId);
  if (!step) {
    return { allowed: false, reason: 'Current step not found', case: current };
  }

  const nextStepId = getMatchingTransition(step.transitions, current);
  if (!nextStepId) {
    return {
      allowed: false,
      reason: 'No valid transition for current state',
      case: current,
    };
  }

  if (nextStepId === current.workflow.currentStepId) {
    return { allowed: false, reason: 'Already at this step', case: current };
  }

  const nextIndex = workflow.steps.findIndex((s) => s.id === nextStepId);
  const updated: CaseData = {
    ...current,
    workflow: {
      ...current.workflow,
      currentStepId: nextStepId,
      currentStepIndex: nextIndex,
      completedSteps: [...current.workflow.completedSteps, step.id],
      status: nextStepId === 'resolved' || nextStepId === 'emergency_redirect' ? 'completed' : current.workflow.status,
    },
    status: nextStepId === 'resolved' ? 'resolved' : current.status === 'open' ? 'in_progress' : current.status,
    updatedAt: new Date().toISOString(),
  };

  if (nextStepId === 'resolved') {
    updated.state = { ...updated.state, phase: 'resolved', readinessStatus: 'completed' };
  } else if (nextStepId.includes('schedule') || nextStepId.includes('visit')) {
    updated.state = { ...updated.state, phase: 'action' };
  } else if (nextStepId.includes('collect') || nextStepId.includes('document')) {
    updated.state = { ...updated.state, phase: 'preparation' };
  }

  const adapter = getAdapter(updated.adapterId);
  if (adapter) {
    const readiness = adapter.calculateReadiness(updated);
    updated.state = {
      ...updated.state,
      readinessScore: readiness.score,
      readinessStatus: readiness.status,
      blockers: readiness.blockers,
    };
  }

  await logAudit({
    caseId: updated.id,
    actor: trigger === 'user_confirms' ? 'user' : 'system',
    action: 'workflow_advance',
    stepId: nextStepId,
    input: { from: step.id, trigger },
    success: true,
  });

  const afterAdvance = await runStepHandler(updated);
  return {
    allowed: true,
    case: afterAdvance,
    message: `Advanced to ${nextStepId}`,
  };
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

export function getCurrentStepInfo(caseData: CaseData) {
  const workflow = getWorkflow(caseData.workflow.definitionId);
  if (!workflow) return null;
  return getWorkflowStep(workflow, caseData.workflow.currentStepId);
}
