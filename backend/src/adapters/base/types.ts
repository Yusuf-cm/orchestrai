import type {
  CaseData,
  Domain,
  Evidence,
  Institution,
  IntentDefinition,
  IntentResult,
  ReadinessResult,
  Requirement,
  SafetyResult,
  WorkflowDefinition,
  WorkflowStep,
} from '@waypoint/shared';

export interface StepHandlerResult {
  success: boolean;
  output?: Record<string, unknown>;
  requirements?: Requirement[];
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

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Contract every domain implements. The core application knows only this
 * interface — a new domain is added by writing an adapter and its workflow
 * definitions, without touching the engine, the case model, or the UI.
 */
export interface ServiceAdapter {
  id: string;
  domain: Domain;
  version: string;

  classifyIntent(utterance: string, context?: CaseContext): IntentResult;
  getSupportedIntents(): IntentDefinition[];

  resolveWorkflow(intent: string, slots: Record<string, unknown>): WorkflowDefinition | null;
  getWorkflow(workflowId: string): WorkflowDefinition | null;

  /** Human-readable case title. Keeps domain copy out of the case service. */
  getCaseTitle(intent: string, slots: Record<string, unknown>): string;

  /** Starting slot values so a case can begin without interrogating the user. */
  getDefaultSlots(intent: string): Record<string, unknown>;

  handlers: Record<string, StepHandler>;

  resolveRequirements(caseData: CaseData): Promise<Requirement[]>;
  validateRequirement(req: Requirement, caseData: CaseData): ValidationResult;
  calculateReadiness(caseData: CaseData): ReadinessResult;
  resolveInstitution(slots: Record<string, unknown>): Institution;
  getEvidence(requirementId: string, context?: CaseContext): Evidence[];

  /** Domains with safety obligations implement this; others may omit it. */
  safetyCheck?(caseData: CaseData): SafetyResult;
}
