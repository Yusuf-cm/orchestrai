// Domain types
export type Domain = 'government' | 'healthcare' | 'insurance' | 'education' | 'banking' | 'legal' | 'utilities';

export type ExecutionMode = 'guide' | 'assist' | 'execute' | 'escalate';

export type VerificationStatus = 'official' | 'commonly_reported' | 'unverified';

export type RequirementStatus = 'unknown' | 'needed' | 'in_progress' | 'satisfied' | 'waived' | 'failed';

export type CaseStatus = 'open' | 'in_progress' | 'waiting' | 'escalated' | 'resolved' | 'abandoned';

export type WorkflowStatus = 'active' | 'waiting' | 'blocked' | 'escalated' | 'completed' | 'cancelled';

export type ReadinessStatus = 'not_ready' | 'almost_ready' | 'ready' | 'completed';

export type CasePhase = 'intake' | 'preparation' | 'action' | 'waiting' | 'followup' | 'resolved';

export type DataClassification = 'public' | 'pii' | 'phi' | 'sensitive';

export type CareLevel = 'self_care' | 'primary_care' | 'urgent_care' | 'emergency';

// Intent
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

// Institution
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

export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  hours?: string;
  phone?: string;
}

export interface Fee {
  label: string;
  amount: number;
  currency: string;
}

// Evidence
export interface Evidence {
  id: string;
  sourceUrl?: string;
  sourceLabel: string;
  verificationStatus: VerificationStatus;
  lastVerified?: string;
  excerpt?: string;
}

// Requirements
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

// Artifacts
export interface Artifact {
  id: string;
  type: 'upload' | 'generated_form' | 'receipt' | 'referral_letter' | 'symptom_log';
  name: string;
  storageRef: string;
  extractedFields?: Record<string, unknown>;
  validationStatus: 'pending' | 'valid' | 'invalid';
  requirementId?: string;
  uploadedAt: string;
}

// Appointments
export interface Appointment {
  id: string;
  providerName: string;
  providerSpecialty?: string;
  datetime: string;
  location?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
}

// Tasks & Actions
export interface Task {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
  stepId?: string;
  dueAt?: string;
}

export interface Blocker {
  requirementId: string;
  reason: string;
}

// Workflow definitions
export type StepType =
  | 'collect_input'
  | 'ask_question'
  | 'validate'
  | 'lookup'
  | 'document_required'
  | 'document_extract'
  | 'generate_document'
  | 'guide_user'
  | 'assist_user'
  | 'execute_action'
  | 'appointment'
  | 'payment'
  | 'wait'
  | 'reminder'
  | 'human_handoff'
  | 'completion';

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
  content?: Record<string, unknown>;
  requirements_ref?: string;
  transitions: WorkflowTransition[];
}

export interface WorkflowDefinition {
  id: string;
  version: string;
  domain: Domain;
  adapter: string;
  institution?: string;
  title: string;
  slots: Array<{ name: string; type: string; required: boolean; enum?: string[] }>;
  steps: WorkflowStep[];
  completion?: { step: string; actions?: string[] };
}

// Case
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

export interface StepTransition {
  from: string;
  to: string;
  at: string;
  trigger: string;
  actor: 'user' | 'system' | 'ai' | 'human_agent';
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
  tasks: Task[];
  evidence: Evidence[];
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

// API types
export interface StartCaseRequest {
  utterance: string;
  userId?: string;
}

export interface AdvanceCaseRequest {
  action: string;
  payload?: Record<string, unknown>;
}

export interface AdvanceCaseResponse {
  allowed: boolean;
  reason?: string;
  case: CaseData;
  message?: string;
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
  careLevel?: CareLevel;
  redirectMessage?: string;
  flags: string[];
}

export interface VoiceSpeakRequest {
  text: string;
  caseId?: string;
}

export interface VoiceSpeakResponse {
  fallback?: boolean;
  text?: string;
  cacheKey?: string;
}

// Provider (healthcare)
export interface Provider {
  id: string;
  name: string;
  specialty: string;
  distance: string;
  acceptingNewPatients: boolean;
  rating: number;
  address: string;
  phone: string;
  inNetwork: boolean;
}
