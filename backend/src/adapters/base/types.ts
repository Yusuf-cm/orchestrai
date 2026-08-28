import type {
  CaseData,
  Evidence,
  Institution,
  IntentDefinition,
  IntentResult,
  ReadinessResult,
  Requirement,
  SafetyResult,
  ValidationResult,
  WorkflowDefinition,
  WorkflowStep,
} from '@waypoint/shared';

export interface StepHandlerResult {
  success: boolean;
  output?: Record<string, unknown>;
  requirements?: Requirement[];
  blockers?: Array<{ requirementId: string; reason: string }>;
  flags?: string[];
  error?: string;
}

export type StepHandler = (
  caseData: CaseData,
  step: WorkflowStep,
  payload?: Record<string, unknown>
) => Promise<StepHandlerResult>;

export interface CaseContext {
  caseId?: string;
  userId?: string;
}

export interface ServiceAdapter {
  id: string;
  domain: CaseData['domain'];
  version: string;

  classifyIntent(utterance: string, context?: CaseContext): IntentResult;
  getSupportedIntents(): IntentDefinition[];
  resolveWorkflow(intent: string, slots: Record<string, unknown>): WorkflowDefinition | null;
  getWorkflow(workflowId: string): WorkflowDefinition | null;

  handlers: Record<string, StepHandler>;

  resolveRequirements(caseData: CaseData): Promise<Requirement[]>;
  validateRequirement(req: Requirement, caseData: CaseData): ValidationResult;
  calculateReadiness(caseData: CaseData): ReadinessResult;
  resolveInstitution(slots: Record<string, unknown>): Institution;
  getEvidence(requirementId: string, context: CaseContext): Evidence[];

  safetyCheck?(caseData: CaseData): SafetyResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
