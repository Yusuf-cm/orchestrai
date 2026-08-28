# Architecture

## Layers

```
Person (voice or text)
   ↓
Next.js interface            renders from step metadata, knows no step names
   ↓
Express API                  session-scoped, ownership checked per request
   ↓
AI orchestrator              language in, structured data out
   ↓
Workflow engine              sole writer of workflow position
   ↓
Execution layer              decides who acts and whether we may act
   ↓
Adapter registry
   ↓
Domain adapter               government · healthcare
   ↓
Institution connector        eCitizen · SHA and county facilities
```

## The separation that matters

The language model handles language. The engine handles state.

| Owned by the language model | Owned by code |
|---|---|
| Intent classification | Workflow transitions |
| Entity extraction | Requirement status |
| Explaining institutional wording | Readiness score |
| Answering questions about a case | Medical urgency |
| — | Execution authorisation |
| — | Audit trail |

Two things follow.

**Behaviour does not depend on a key.** `classifyByKeyword()` is the baseline path. When `OPENAI_API_KEY` is present the model runs first and keyword extraction still overrides it for county and duration, because a regular expression is more reliable than a model at pulling "3 weeks" out of a sentence.

**Urgency is reviewable.** `shaHealthConnector.triage()` matches an explicit list of red-flag phrases in English and Kiswahili. A model is never asked whether someone is having an emergency.

## Request path

Starting a case:

1. `POST /api/cases/start` with an utterance
2. Orchestrator classifies intent; adapters each report confidence; the more confident wins
3. The chosen adapter supplies the workflow, case title, default slots, and institution
4. `createInitialCase()` places the case at the first step
5. `advanceUntilUserInput()` runs automatic steps — lookups and validations — and stops at the first step needing a person
6. The case is returned with `currentStep` attached

Changing a case:

1. `PATCH /api/cases/:id` describes what happened: a requirement ticked, a facility chosen, a step confirmed
2. Ownership is verified before anything is written
3. `updateCase()` applies the change and recalculates readiness
4. The engine decides whether a transition is permitted
5. `_user_confirmed` is cleared so one confirmation moves one step

The service layer describes events. The engine decides consequences.

## Modules

### `services/workflow/`

| File | Responsibility |
|---|---|
| `loader.ts` | Parse, validate, and cache YAML. Refuses invalid definitions |
| `conditions.ts` | The condition grammar, and the validator the loader uses |
| `engine.ts` | Transitions, handler execution, readiness, auto-advance |

### `services/execution/`

Turns a step's declared mode into a plan: who acts, whether it runs automatically, whether authorisation is needed. Read-only lookups run freely; appointments, payments, and handoffs require a grant.

### `services/orchestrator/`

OpenAI calls with structured output, plus the keyword classifier. Also builds the deterministic sentence spoken aloud, so wording never drifts mid-demo and the audio cache stays warm.

### `services/voice/`

ElevenLabs in both directions. Scribe for transcription, Turbo or Multilingual for playback depending on language, cached by a hash of text, voice, and model.

### `adapters/`

Each adapter owns its intent taxonomy, workflow binding, requirement resolution, readiness formula, case titles, and default slots. Nothing in the core knows what a police abstract is.

### `connectors/`

Curated institutional data with sources attached. `ecitizen-ke` holds ID replacement requirements, Huduma Centres, and fees. `sha-health-ke` holds triage rules, care levels, and facilities.

## Case model

A case is the unit of persistence — conversation is a view over it.

```typescript
CaseData {
  id, userId, title
  domain, adapterId, institution, service
  intent      { rawUtterance, classifiedIntent, confidence, extractedEntities }
  workflow    { definitionId, currentStepId, completedSteps, slots }
  state       { phase, readinessScore, readinessStatus, blockers, flags }
  requirements[]  each with status and verification provenance
  artifacts[]     attached documents
  appointments[]
  evidence[]      sources behind the requirements
  status
}
```

Served as a `CaseView`, which adds `currentStep` — including its execution plan — so the interface can render any workflow without knowing step names.

Stored in Postgres or SQLite with structured fields as JSON columns. The case object changes shape as domains are added; normalising it into twenty tables would slow that down for no benefit at this size.

## Readiness

Readiness is the product's central claim, so each adapter defines it.

Government is proportional: mandatory requirements satisfied over mandatory requirements total.

Health is weighted, because being ready means knowing where to go as well as what to carry:

| Checkpoint | Weight |
|---|---|
| Symptoms described | 15 |
| Safety screening complete | 20 |
| Facility chosen | 25 |
| Documents accounted for | 40 |

Recalculated after every change so the score never lags the checklist.

## Performance

| Technique | Where |
|---|---|
| Workflows parsed and validated once at boot | `loader.ts` |
| Adapters registered once as singletons | `registry.ts` |
| Audio cached by content hash | `voice/elevenlabs.ts` |
| Mutations return the full case; no refetch | `api.ts` |
| No polling — cases change only when the user acts | `providers.tsx` |
| Indexed on `(userId, updatedAt)` and `(caseId, timestamp)` | `schema.prisma` |
| Temperature 0 on classification | `orchestrator/` |

## Security

Implemented:

- Session tokens; no route returns case data unauthenticated
- Ownership verified before every read and mutation
- Uploads restricted by MIME type and size; not served back publicly
- CORS restricted to configured origins
- Audit failures logged rather than swallowed
- API keys server-side only

Not implemented, and would be required before real users:

- Identity verification
- Encryption at rest for identity and health data
- Retention and deletion policy
- Rate limiting
- A compliance basis for holding health information
