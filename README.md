# Waypoint

**Know what to bring, before you go.**

People rarely fail at institutions because they lack determination. They fail because nobody told them the police abstract was mandatory, or that a health centre could have handled it without a day lost at a referral hospital.

Waypoint takes what a person says they need, works out the institutional process behind it, and answers one question at every moment: **are you ready?**

Built for Kenyan government and health services, on an architecture where each new domain is a plug-in rather than a rewrite.

---

## What it does today

### Government — replace a lost national ID

Speak or type *"I lost my ID"* (English or Kiswahili). Waypoint opens a case against eCitizen and the National Registration Bureau, then produces the real checklist: police abstract with an OB number, birth certificate, your old ID number, a parent's details, the KES 1,000 fee, and an eCitizen account. Each item shows whether it is officially documented or simply what applicants keep reporting. Readiness only reaches 100% when every mandatory item is accounted for, and only then does it hand you the Huduma Centre details.

### Health — reach the right level of care

Describe symptoms and Waypoint screens for emergencies with explicit rules, in English and Kiswahili. If nothing is urgent, it recommends a level of facility — dispensary, sub-county, or county referral — and lists accredited options with the recommended level marked. Going to a Level 5 hospital for something a health centre handles costs a day in a queue; this exists to prevent that.

Waypoint does not diagnose. It never claims to.

---

## Architecture

```
Person (voice or text)
   ↓
AI orchestrator          reads language, extracts entities, explains wording
   ↓
Workflow engine          owns state, transitions, validation, audit
   ↓
Adapter registry
   ↓
Domain adapter           government · healthcare · (insurance, education, …)
   ↓
Institution connector    eCitizen · SHA and county facilities
   ↓
Guide · Assist · Execute · Escalate
```

### The rule that matters

**The language model never decides what happens next.**

It classifies intent, pulls entities out of a sentence, and rewrites institutional language into plain terms. Workflow position, requirement status, readiness, and medical urgency are computed by the engine, the adapters, and explicit rules.

Two consequences worth knowing:

- Behaviour is identical with or without an OpenAI key. Keyword classification is the baseline path, not a degraded one.
- An emergency is detected by a reviewable list of red-flag phrases, not by a model's judgement.

### Adding a domain

Write an adapter implementing `ServiceAdapter`, add connector data, add a workflow YAML, register the adapter. The engine, case model, API, and interface are untouched — the UI renders from step metadata, so it has no knowledge of specific step names.

---

## Running it

### Requirements

Node.js 20+, npm 10+.

### Setup

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm run db:push
npm run dev
```

| Service | URL |
|---|---|
| App | http://localhost:43123 |
| API | http://localhost:4000 |
| Health | http://localhost:4000/health |

### Keys

Both are optional. Waypoint runs fully without them.

| Variable | Effect when absent |
|---|---|
| `OPENAI_API_KEY` | Keyword classification handles intent; explanations come from case data |
| `ELEVENLABS_API_KEY` | Voice input is unavailable; playback falls back to on-device speech |

### Tests

```bash
npm run test:milestone
```

24 tests covering the condition grammar, workflow validation, one-click-one-step advancement, readiness, emergency triage in both languages, execution authorisation, and intent routing.

---

## Voice

Voice is the primary input, not an accessory. Someone standing outside a Huduma Centre can describe the problem out loud rather than typing it on a cracked screen.

- **In** — recorded in the browser, transcribed by ElevenLabs Scribe, which handles the English/Kiswahili mixing that is normal in Kenyan speech
- **Out** — the next action read back, Turbo for English and Multilingual for Kiswahili
- **Cached** — audio is keyed by a hash of text, voice, and model, so repeat playback is instant and costs nothing

---

## Project layout

```
waypoint/
├── docs/
│   ├── ARCHITECTURE.md      how the layers fit together
│   ├── ADAPTERS.md          adding a domain
│   ├── API.md               endpoint reference
│   ├── WORKFLOWS.md         the condition grammar and step types
│   └── DEPLOYMENT.md        Render and ElevenLabs
├── packages/shared/         types shared by both sides
├── backend/
│   ├── src/adapters/        government, healthcare
│   ├── src/connectors/      ecitizen-ke, sha-health-ke
│   ├── src/services/        workflow engine, execution, orchestrator, voice, audit
│   └── src/workflows/       YAML definitions, validated at boot
├── frontend/                Next.js, case-centric and mobile-first
└── render.yaml
```

---

## Honest scope

Built in one night. What is real and what is not:

**Real** — the workflow engine and its validation, the adapter boundary, deterministic triage, requirement provenance, session scoping and ownership checks, the audit trail, ElevenLabs voice in both directions.

**Curated, not live** — requirement data, Huduma Centre listings, and facility data are hand-assembled with sources attached. Nothing is fetched from a government API, because those APIs are not publicly available.

**Not built** — real identity verification, institution integrations, appointment booking against a real system, document reading. Attaching a document records it against a requirement; Waypoint does not inspect its contents or verify it with anyone.

Anything a person would act on carries its source and the date it was checked, precisely because the data is curated.

---

## Licence

MIT
