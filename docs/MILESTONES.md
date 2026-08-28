# Milestones & Testing Plan

Build and test incrementally. Run `npm run test:milestone` after each milestone.

---

## Milestone 0 — Scaffold ✅

**Goal:** Monorepo structure, docs, env templates.

**Deliverables:**
- [x] Folder structure
- [x] README + docs
- [x] Root workspace config

**Test:** `npm install` succeeds.

---

## Milestone 1 — Shared types + Database

**Goal:** Core types and Prisma schema.

**Deliverables:**
- `packages/shared` — Case, Workflow, Requirement types
- Prisma schema — User, Case, Requirement, Artifact, Appointment, AuditEvent, Evidence
- Database push + seed script

**Test:**
```bash
npm run db:push
npm run db:seed
npm run test:milestone -- --grep "Milestone 1"
```

**Verify:**
- Demo user exists
- Can create a case record in DB

---

## Milestone 2 — Workflow Engine

**Goal:** Deterministic workflow execution.

**Deliverables:**
- YAML workflow loader (cached)
- Step evaluator + transition conditions
- `advanceCase()`, `getCurrentStep()`, `evaluateReadiness()`

**Test:**
```bash
npm run test:milestone -- --grep "Milestone 2"
```

**Verify:**
- Load `gov.ca_id_replacement.yaml`
- Advance through steps with mock slot data
- Invalid transitions rejected

---

## Milestone 3 — Adapters + Connectors

**Goal:** Government and healthcare domain logic.

**Deliverables:**
- `ServiceAdapter` interface + registry
- `GovernmentAdapter` + `dmv-ca` connector
- `HealthcareAdapter` + `health-mock` connector + triage rules
- Workflow YAML files for both domains

**Test:**
```bash
npm run test:milestone -- --grep "Milestone 3"
```

**Verify:**
- Gov: resolve requirements for CA ID replacement
- Health: red-flag symptoms → emergency redirect
- Health: normal knee pain → primary care path

---

## Milestone 4 — Backend API + AI + Voice

**Goal:** REST API, orchestrator, ElevenLabs.

**Deliverables:**
- Express server with routes
- `POST /api/cases/start` — intent → case
- `GET/PATCH /api/cases/:id` — case CRUD
- `POST /api/cases/:id/advance` — engine-validated step advance
- `POST /api/cases/:id/upload` — artifact upload
- `POST /api/cases/:id/chat` — AI clarification (streaming)
- `POST /api/voice/speak` — ElevenLabs TTS
- Audit logging on all mutations

**Test:**
```bash
npm run test:milestone -- --grep "Milestone 4"
```

**Verify:**
- Health endpoint returns 200
- Start gov case from utterance
- AI cannot advance without engine validation
- Voice endpoint returns audio (or graceful fallback)

---

## Milestone 5 — Frontend UI

**Goal:** Case-centric dashboard.

**Deliverables:**
- Home — intent input, active cases
- Case detail — readiness bar, next action, requirements, timeline
- Document upload
- Healthcare safety banner
- Voice play button (ElevenLabs)
- Chat side panel

**Test:** Manual + `curl` API checks.

**Verify:**
- Full gov flow in browser
- Full healthcare flow in browser
- No page lag > 200ms for navigation

---

## Milestone 6 — Deploy

**Goal:** Render deployment.

**Deliverables:**
- `render.yaml`
- Production env docs
- PostgreSQL on Render
- CORS + API URL config

**Test:**
```bash
curl https://waypoint-api.onrender.com/health
```

---

## Testing commands

```bash
# All milestone tests
npm run test:milestone

# Backend unit tests
npm run test -w backend

# Manual API smoke test
npm run smoke -w backend
```

## What we mock (hackathon)

| Component | Mock strategy |
|-----------|---------------|
| DMV API | Static JSON in dmv-ca connector |
| Provider search | 5 hardcoded providers |
| Appointment booking | Confirmation modal |
| Document OCR | Field extraction on filename match |
| Auth | Single demo user |
| ElevenLabs | Real API with fallback to browser TTS |

## What we do NOT build

- Real institution OAuth
- Admin workflow editor
- Email/SMS notifications
- Multiple states/institutions
- User registration
