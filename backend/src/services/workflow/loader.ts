import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import type { WorkflowDefinition } from '@waypoint/shared';

const workflowCache = new Map<string, WorkflowDefinition>();

function getWorkflowsDir(): string {
  const candidates = [
    path.join(__dirname, 'workflows'),
    path.join(__dirname, '..', 'workflows'),
    path.join(process.cwd(), 'src', 'workflows'),
    path.join(process.cwd(), 'dist', 'workflows'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

export function loadWorkflows(): void {
  const dir = getWorkflowsDir();
  if (!fs.existsSync(dir)) {
    console.warn(`Workflows directory not found: ${dir}`);
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    const parsed = yaml.parse(content) as { workflow: WorkflowDefinition };
    if (parsed?.workflow?.id) {
      workflowCache.set(parsed.workflow.id, parsed.workflow);
    }
  }
  console.log(`Loaded ${workflowCache.size} workflows from ${dir}`);
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
