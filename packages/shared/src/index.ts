export type Domain =
  | 'government'
  | 'healthcare'
  | 'insurance'
  | 'education'
  | 'banking'
  | 'legal'
  | 'utilities';

export type ExecutionMode = 'guide' | 'assist' | 'execute' | 'escalate';

export type VerificationStatus = 'official' | 'commonly_reported' | 'unverified';

export type RequirementStatus = 'unknown' | 'needed' | 'in_progress' | 'satisfied' | 'waived' | 'failed';

export type CaseStatus = 'open' | 'in_progress' | 'waiting' | 'escalated' | 'resolved' | 'abandoned';

export type WorkflowStatus = 'active' | 'waiting' | 'blocked' | 'escalated' | 'completed' | 'cancelled';

export type ReadinessStatus = 'not_ready' | 'almost_ready' | 'ready' | 'completed';

export type CasePhase = 'intake' | 'preparation' | 'action' | 'waiting' | 'followup' | 'resolved';

export type Language = 'en' | 'sw';

/** Step types the engine implements. Adding one requires engine support. */
export type StepType =
  | 'collect_input'
  | 'ask_question'
  | 'validate'
  | 'lookup'
  | 'document_required'
  | 'guide_user'
  | 'assist_user'
  | 'appointment'
  | 'payment'
  | 'human_handoff'
  | 'completion';

export interface IntentResult {
  classifiedIntent: string;
  confidence: number;
  domain: Domain;
  extractedEntities: Record<string, unknown>;
  rawUtterance: string;
}

export interface IntentDefinition {
  id: string;
  domain: Domain;
  label: string;
  keywords: string[];
  workflowId: string;
}

export interface Institution {
  id: string;
  name: string;
  jurisdiction?: string;
  domain: Domain;
}

export interface Service {
  id: string;
  name: string;
  officialUrl?: string;
}

export interface Evidence {
  id: string;
  sourceUrl?: string;
  sourceLabel: string;
  verificationStatus: VerificationStatus;
  lastVerified?: string;
}

export interface Requirement {
  id: string;
  label: string;
  description?: string;
  category: 'document' | 'eligibility' | 'fee' | 'appointment' | 'action' | 'information';
  status: RequirementStatus;
  mandatory: boolean;
  verificationStatus: VerificationStatus;
  evidenceIds: string[];
  satisfiedBy?: string;
  acceptableDocuments?: string[];
}

export interface Artifact {
  id: string;
  type: 'upload' | 'generated_form' | 'receipt' | 'referral_letter';
  name: string;
  storageRef: string;
  validationStatus: 'pending' | 'valid' | 'invalid';
  requirementId?: string;
  uploadedAt: string;
}

export interface Appointment {
  id: string;
  providerName: string;
  providerSpecialty?: string;
  datetime: string;
  location?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
}

export interface Blocker {
  requirementId: string;
  reason: string;
}

export interface WorkflowTransition {
  to: string;
  when: string;
}

export interface WorkflowStep {
  id: string;
  type: StepType;
  mode: ExecutionMode;
  title?: string;
  description?: string;
  inputs?: string[];
  handler?: string;
  transitions: WorkflowTransition[];
}

export interface WorkflowDefinition {
  id: string;
  version: string;
  domain: Domain;
  adapter: string;
  institution?: string;
  title: string;
  slots: Array<{ name: string; type: string; required: boolean }>;
  steps: WorkflowStep[];
  completion?: { step: string };
}

export interface CaseIntent {
  rawUtterance: string;
  classifiedIntent: string;
  confidence: number;
  extractedEntities: Record<string, unknown>;
  clarifications: Array<{ question: string; answer: string }>;
}

export interface CaseWorkflow {
  definitionId: string;
  definitionVersion: string;
  currentStepId: string;
  currentStepIndex: number;
  status: WorkflowStatus;
  completedSteps: string[];
  slots: Record<string, unknown>;
}

export interface CaseState {
  phase: CasePhase;
  readinessScore: number;
  readinessStatus: ReadinessStatus;
  blockers: Blocker[];
  flags: string[];
}

export interface AuditEvent {
  id: string;
  caseId: string;
  timestamp: string;
  actor: 'user' | 'system' | 'ai' | 'human_agent';
  action: string;
  stepId?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  success: boolean;
}

export interface CaseData {
  id: string;
  userId: string;
  title: string;
  domain: Domain;
  adapterId: string;
  institution: Institution;
  service?: Service;
  intent: CaseIntent;
  workflow: CaseWorkflow;
  state: CaseState;
  requirements: Requirement[];
  artifacts: Artifact[];
  appointments: Appointment[];
  evidence: Evidence[];
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionPlan {
  mode: ExecutionMode;
  actor: 'user' | 'system' | 'human_agent';
  autoExecute: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

/** The current step travels with the case so the UI stays workflow-agnostic. */
export interface CurrentStepView {
  id: string;
  type: StepType;
  mode: ExecutionMode;
  title: string;
  description?: string;
  isTerminal: boolean;
  execution: ExecutionPlan;
}

export interface CaseView extends CaseData {
  currentStep: CurrentStepView | null;
  audit?: AuditEvent[];
}

export interface ReadinessResult {
  score: number;
  status: ReadinessStatus;
  blockers: Blocker[];
  satisfiedCount: number;
  totalMandatory: number;
}

export interface SafetyResult {
  safe: boolean;
  careLevel?: string;
  redirectMessage?: string;
  flags: string[];
}

export interface HudumaCentre {
  id: string;
  name: string;
  address: string;
  city: string;
  county: string;
  hours: string;
  phone: string;
  services: string[];
}

export interface HealthFacility {
  id: string;
  name: string;
  level: string;
  county: string;
  address: string;
  distance: string;
  shaAccredited: boolean;
  openNow: boolean;
  services: string[];
}
