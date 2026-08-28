# Adapters Guide

## Adding a new domain

### 1. Create adapter

```typescript
// backend/src/adapters/insurance/index.ts
export class InsuranceAdapter implements ServiceAdapter {
  id = 'insurance-adapter-v1';
  domain = 'insurance' as const;

  classifyIntent(utterance: string) { ... }
  resolveWorkflow(intent: string, slots: Record<string, unknown>) { ... }
  handlers = {
    'insurance.resolveRequirements': this.resolveRequirements.bind(this),
  };
  calculateReadiness(caseData: CaseData) { ... }
}
```

### 2. Create connectors

```typescript
// backend/src/connectors/aetna/index.ts
export const aetnaConnector: InstitutionConnector = {
  id: 'aetna',
  getRequirements(serviceId, context) { ... },
  getLocations(zip) { ... },
};
```

### 3. Add workflow YAML

```yaml
# backend/src/workflows/insurance.appeal_denial.yaml
workflow:
  id: insurance.appeal_denial_v1
  domain: insurance
  adapter: insurance-adapter-v1
  steps: [...]
```

### 4. Register adapter

```typescript
// backend/src/adapters/registry.ts
registry.register(new InsuranceAdapter());
```

### 5. Update AI orchestrator intents

Add intent definitions to the classification prompt schema.

## Adapter interface

```typescript
interface ServiceAdapter {
  id: string;
  domain: Domain;
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
```

## Institution connector interface

```typescript
interface InstitutionConnector {
  id: string;
  institutionId: string;
  adapterId: string;
  name: string;

  getServices(): Service[];
  getRequirements(serviceId: string, context: Record<string, unknown>): Requirement[];
  getLocations(zip: string): Location[];
  getFees(serviceId: string): Fee[];
}
```

## Step handlers

Handlers are called by the workflow engine for `lookup`, `validate`, and `execute` step types.

```typescript
type StepHandler = (
  caseData: CaseData,
  step: WorkflowStep,
  payload?: Record<string, unknown>
) => Promise<StepHandlerResult>;

interface StepHandlerResult {
  success: boolean;
  output?: Record<string, unknown>;
  requirements?: Requirement[];
  blockers?: Blocker[];
  error?: string;
}
```

## Verification statuses

| Status | Meaning | UI badge |
|--------|---------|----------|
| `official` | From institution's official source | Green |
| `commonly_reported` | Widely reported but not officially documented | Amber |
| `unverified` | Unknown confidence | Gray |

## Current adapters

| Adapter | Domain | Connector | Workflow |
|---------|--------|-----------|----------|
| `gov-adapter-v1` | government | `dmv-ca` | `gov.ca_id_replacement_v1` |
| `health-adapter-v1` | healthcare | `health-mock` | `health.musculoskeletal_nav_v1` |
