import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import type { WorkflowDefinition, StepType } from '@waypoint/shared';
import { isValidCondition } from './conditions';

const workflowCache = new Map<string, WorkflowDefinition>();

const IMPLEMENTED_STEP_TYPES: StepType[] = [
  'collect_input',
  'ask_question',
  'validate',
  'lookup',
  'document_required',
  'guide_user',
  'assist_user',
  'appointment',
  'payment',
  'human_handoff',
  'completion',
];

function getWorkflowsDir(): string {
  const candidates = [
    path.join(__dirname, 'workflows'),
    path.join(__dirname, '..', 'workflows'),
    path.join(__dirname, '..', '..', 'workflows'),
    path.join(process.cwd(), 'src', 'workflows'),
    path.join(process.cwd(), 'dist', 'workflows'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

/**
 * Validates a workflow before it is cached. A workflow that references an
 * unknown condition or a missing step would silently strand a case at runtime,
 * so we reject it at startup instead.
 */
export function validateWorkflow(workflow: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const stepIds = new Set(workflow.steps.map((s) => s.id));

  if (!workflow.id) errors.push('workflow.id is required');
  if (!workflow.steps?.length) errors.push('workflow must define at least one step');

  for (const step of workflow.steps ?? []) {
    if (!IMPLEMENTED_STEP_TYPES.includes(step.type)) {
      errors.push(`step "${step.id}": unimplemented step type "${step.type}"`);
    }
    for (const t of step.transitions ?? []) {
      if (!stepIds.has(t.to)) {
        errors.push(`step "${step.id}": transition targets unknown step "${t.to}"`);
      }
      if (!isValidCondition(t.when)) {
        errors.push(`step "${step.id}": unsupported condition "${t.when}"`);
      }
    }
  }

  const terminal = workflow.steps?.filter((s) => (s.transitions ?? []).length === 0) ?? [];
  if (terminal.length === 0) {
    errors.push('workflow has no terminal step');
  }

  return errors;
}

export function loadWorkflows(): { loaded: number; errors: string[] } {
  const dir = getWorkflowsDir();
  workflowCache.clear();
  const allErrors: string[] = [];

  if (!fs.existsSync(dir)) {
    return { loaded: 0, errors: [`workflows directory not found: ${dir}`] };
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const parsed = yaml.parse(content) as { workflow: WorkflowDefinition };
      const workflow = parsed?.workflow;
      if (!workflow?.id) {
        allErrors.push(`${file}: missing workflow.id`);
        continue;
      }
      // Terminal steps omit `transitions` in YAML; normalise so the engine can
      // treat every step uniformly.
      workflow.steps = (workflow.steps ?? []).map((step) => ({
        ...step,
        transitions: step.transitions ?? [],
      }));
      const errors = validateWorkflow(workflow);
      if (errors.length > 0) {
        allErrors.push(...errors.map((e) => `${file}: ${e}`));
        continue;
      }
      workflowCache.set(workflow.id, workflow);
    } catch (err) {
      allErrors.push(`${file}: ${err instanceof Error ? err.message : 'parse error'}`);
    }
  }

  return { loaded: workflowCache.size, errors: allErrors };
}

export function getWorkflow(id: string): WorkflowDefinition | null {
  return workflowCache.get(id) ?? null;
}

export function listWorkflows(): WorkflowDefinition[] {
  return Array.from(workflowCache.values());
}

export function getWorkflowStep(workflow: WorkflowDefinition, stepId: string) {
  return workflow.steps.find((s) => s.id === stepId) ?? null;
}
