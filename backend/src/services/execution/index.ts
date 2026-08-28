import type { CaseData, ExecutionMode, WorkflowStep } from '@waypoint/shared';

/**
 * Execution layer.
 *
 * Every step declares how the work gets done. This module is the single place
 * that decides who acts and whether the system is permitted to act on the
 * person's behalf, so the distinction between "we tell you" and "we do it" is
 * enforced in code rather than described in a document.
 */

export interface ExecutionPlan {
  mode: ExecutionMode;
  actor: 'user' | 'system' | 'human_agent';
  autoExecute: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

export function planExecution(step: WorkflowStep, caseData: CaseData): ExecutionPlan {
  switch (step.mode) {
    case 'guide':
      return {
        mode: 'guide',
        actor: 'user',
        autoExecute: false,
        requiresConfirmation: true,
        reason: 'The person performs this step in the real world',
      };

    case 'assist':
      return {
        mode: 'assist',
        actor: 'user',
        autoExecute: false,
        requiresConfirmation: true,
        reason: 'The system prepares the work; the person submits it',
      };

    case 'execute': {
      const granted = hasExecutionGrant(caseData, step);
      return {
        mode: 'execute',
        actor: 'system',
        autoExecute: granted,
        requiresConfirmation: !granted,
        reason: granted
          ? 'Authorised system action'
          : 'Awaiting the person\u2019s authorisation before acting',
      };
    }

    case 'escalate':
      return {
        mode: 'escalate',
        actor: 'human_agent',
        autoExecute: false,
        requiresConfirmation: false,
        reason: 'Routed to a person; automation is not appropriate here',
      };
  }
}

/**
 * Steps that read data or compute a result run automatically. Steps that touch
 * the outside world, cost money, or represent a real-world action require the
 * person to act or confirm first.
 */
export function requiresUserConfirmation(step: WorkflowStep): boolean {
  if (step.mode === 'execute' && !stepMutatesExternalState(step)) return false;
  if (step.type === 'lookup' || step.type === 'validate') return false;
  return true;
}

function stepMutatesExternalState(step: WorkflowStep): boolean {
  return (
    step.type === 'appointment' ||
    step.type === 'payment' ||
    step.type === 'human_handoff'
  );
}

/**
 * Hackathon scope: grants are implicit for read-only lookups and explicit for
 * anything that changes state elsewhere. A production system would store signed
 * grants per institution with scopes and expiry.
 */
function hasExecutionGrant(caseData: CaseData, step: WorkflowStep): boolean {
  if (!stepMutatesExternalState(step)) return true;
  const grants = (caseData.workflow.slots._execution_grants as string[]) ?? [];
  return grants.includes(step.id);
}

export function describeMode(mode: ExecutionMode): { label: string; description: string } {
  switch (mode) {
    case 'guide':
      return { label: 'Guided', description: 'We tell you exactly what to do' };
    case 'assist':
      return { label: 'Assisted', description: 'We prepare this for you' };
    case 'execute':
      return { label: 'Automated', description: 'We do this for you' };
    case 'escalate':
      return { label: 'Escalated', description: 'A person takes this over' };
  }
}
