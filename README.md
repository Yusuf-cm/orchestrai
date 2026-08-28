# Waypoint

**Tell us what you need done. We build the case, run the workflow, and tell you when you're ready.**

Waypoint is an AI-powered action layer between people and complex institutions. It translates natural-language goals into structured, persistent **cases**, runs deterministic **workflows**, and operates in **Guide / Assist / Execute / Escalate** modes — starting with government and healthcare.

## Quick start

### Prerequisites

- Node.js 20+
- npm 10+
- API keys: [OpenAI](https://platform.openai.com), [ElevenLabs](https://elevenlabs.io) (optional for voice)

### 1. Clone and install

```bash
git clone <repo-url>
cd waypoint
npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env`:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
PORT=4000
CORS_ORIGIN=http://localhost:43123
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Initialize database

```bash
npm run db:push
npm run db:seed
```

### 4. Run locally

```bash
npm run dev
```

- **Frontend:** http://localhost:43123
- **Backend API:** http://localhost:4000
- **Health check:** http://localhost:4000/health

### 5. Run milestone tests

```bash
npm run test:milestone
```

## Project structure

```
waypoint/
├── docs/                    # Architecture & guides
├── packages/shared/         # Shared TypeScript types
├── backend/                 # Express API (deploy to Render)
│   ├── src/
│   │   ├── adapters/        # Domain adapters (gov, healthcare)
│   │   ├── connectors/      # Institution connectors (dmv-ca, etc.)
│   │   ├── routes/          # REST API
│   │   ├── services/        # Workflow engine, AI, voice, audit
│   │   └── workflows/       # YAML workflow definitions
│   └── prisma/              # Database schema
├── frontend/                # Next.js case-centric UI
└── render.yaml              # Render deployment config
```

## Core concepts

| Concept | Description |
|---------|-------------|
| **Case** | Persistent record of a real-world goal (lost ID, knee pain, etc.) |
| **Workflow** | Versioned YAML definition of steps and transitions |
| **Adapter** | Pluggable domain module (government, healthcare) |
| **Connector** | Institution-specific data (DMV CA, mock health system) |
| **Engine** | Deterministic state machine — AI never owns transitions |

## Demo flows

### Government — Replace lost California ID

1. Say: *"I lost my California driver's license"*
2. Answer 3 clarifying questions
3. See requirements with official source badges
4. Upload documents → readiness score updates
5. Hit **100% Ready** → office guide with fees and checklist

### Healthcare — Knee pain care navigation

1. Say: *"My knee has been hurting for 3 weeks when I run"*
2. Symptom intake + safety triage (not a diagnosis)
3. Care recommendation + provider list
4. Book mock appointment + visit prep checklist

## Deployment (Render)

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

1. Push repo to GitHub
2. Connect to Render using `render.yaml`
3. Set environment variables in Render dashboard
4. Deploy backend + frontend as web services

## Documentation

| Doc | Contents |
|-----|----------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, data flow, principles |
| [MILESTONES.md](./docs/MILESTONES.md) | Build plan with test checkpoints |
| [API.md](./docs/API.md) | REST API reference |
| [ADAPTERS.md](./docs/ADAPTERS.md) | How to add new domains |
| [GETTING_STARTED.md](./docs/GETTING_STARTED.md) | Step-by-step setup and demo guide |

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, Tailwind, shadcn/ui |
| Backend | Express, TypeScript, Prisma |
| Database | SQLite (dev) / PostgreSQL (Render) |
| AI | OpenAI GPT-4o (structured outputs) |
| Voice | ElevenLabs TTS |
| Deploy | Render (backend + frontend) |

## License

MIT
