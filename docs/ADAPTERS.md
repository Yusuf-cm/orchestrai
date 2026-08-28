# Adapters

An adapter is how a domain plugs in. The engine, case model, API, and interface do not change when one is added.

## The contract

```typescript
interface ServiceAdapter {
  id: string;
  domain: Domain;
  version: string;

  classifyIntent(utterance: string): IntentResult;
  getSupportedIntents(): IntentDefinition[];

  resolveWorkflow(intent: string, slots: Record<string, unknown>): WorkflowDefinition | null;
  getWorkflow(workflowId: string): WorkflowDefinition | null;

  getCaseTitle(intent: string, slots: Record<string, unknown>): string;
  getDefaultSlots(intent: string): Record<string, unknown>;

  handlers: Record<string, StepHandler>;

  resolveRequirements(caseData: CaseData): Promise<Requirement[]>;
  validateRequirement(req: Requirement, caseData: CaseData): ValidationResult;
  calculateReadiness(caseData: CaseData): ReadinessResult;
  resolveInstitution(slots: Record<string, unknown>): Institution;
  getEvidence(requirementId: string): Evidence[];

  safetyCheck?(caseData: CaseData): SafetyResult;
}
```

`getCaseTitle` and `getDefaultSlots` exist so no domain copy leaks into the case service. `safetyCheck` is optional — healthcare implements it, government has nothing to screen for.

## Adding a domain

Four steps, in order.

### 1. Connector data

Institutional facts, with sources.

```typescript
// backend/src/connectors/nhif-appeals/data.ts
export const APPEAL_EVIDENCE = [
  {
    id: 'ev_appeals_policy',
    sourceUrl: 'https://sha.go.ke/appeals',
    sourceLabel: 'SHA — benefit appeals procedure',
    verificationStatus: 'official' as const,
    lastVerified: '2026-08-01',
  },
];
```

Mark anything not officially published as `commonly_reported`. Guessing and labelling it `official` is the one thing that makes the product worse than a search engine.

### 2. Workflow YAML

See [WORKFLOWS.md](./WORKFLOWS.md) for the step types and condition grammar. The server refuses to start on an invalid definition, so a mistake here surfaces immediately.

### 3. Adapter

```typescript
export class InsuranceAdapter implements ServiceAdapter {
  id = 'insurance-adapter-v1';
  domain = 'insurance' as const;
  version = '1.0.0';

  handlers = {
    'insurance.resolveRequirements': this.handleRequirements.bind(this),
  };

  classifyIntent(utterance: string): IntentResult { /* keywords, then entities */ }
  getCaseTitle() { return 'Appeal a rejected claim'; }
  getDefaultSlots() { return { county: 'Nairobi' }; }
  calculateReadiness(caseData: CaseData): ReadinessResult { /* what "ready" means here */ }
  // …
}
```

### 4. Register it

```typescript
// backend/src/index.ts
registerAdapter(new InsuranceAdapter());
```

Routing updates itself: `classifyIntentAcrossAdapters()` asks every registered adapter for a confidence score and takes the highest.

## What you do not touch

- `services/workflow/*` — unless you need a new condition form
- `services/case-service.ts` — it knows nothing about domains
- `services/execution/*` — modes are already enforced
- The frontend — it renders from step metadata

Add a step type and you will need engine support. Add a step, a requirement, or a whole domain and you will not.

## Handlers

Handlers back `lookup` and `validate` steps. They return data; the engine applies it.

```typescript
type StepHandler = (
  caseData: CaseData,
  step: WorkflowStep
) => Promise<{
  success: boolean;
  output?: Record<string, unknown>;   // merged into slots
  requirements?: Requirement[];       // replaces the list
  flags?: string[];
  error?: string;
}>;
```

`resolveRequirements` is called repeatedly, so preserve existing status:

```typescript
const existing = new Map(caseData.requirements.map((r) => [r.id, r]));
return definitions.map((d) => ({
  ...d,
  status: existing.get(d.id)?.status ?? 'needed',
}));
```

Without this, loading requirements again would silently untick everything the person had already gathered.

## Readiness

Readiness answers "can this person succeed at their next real-world action?" It is not a progress bar over steps.

Government counts documents, because that is what turns someone away at the counter. Health weights knowing where to go alongside carrying the right things, because arriving prepared at the wrong facility still costs a day.

Define it for what actually causes failure in your domain.

## Verification status

| Status | Use when | Shown as |
|---|---|---|
| `official` | The institution publishes it | Official, green |
| `commonly_reported` | Applicants consistently report it; not published | Reported, ochre |
| `unverified` | You could not confirm it | Unverified, grey |

## Safety

Implement `safetyCheck` for any domain where a wrong answer causes harm, and keep it rule-based. Healthcare matches explicit red-flag phrases in English and Kiswahili. A language model is never asked to judge urgency.

Route escalations to a terminal `human_handoff` step with `mode: escalate` so the engine cannot advance past it.

## Currently registered

| Adapter | Domain | Connector | Workflow |
|---|---|---|---|
| `gov-adapter-v1` | government | `ecitizen-ke` | `gov.ke_id_replacement_v1` |
| `health-adapter-v1` | healthcare | `sha-health-ke` | `health.ke_care_navigation_v1` |
