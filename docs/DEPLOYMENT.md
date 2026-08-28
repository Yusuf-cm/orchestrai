# Deployment Guide

## Render (recommended)

This project uses `render.yaml` for infrastructure-as-code.

### Services

| Service | Type | Port |
|---------|------|------|
| `waypoint-api` | Web Service (Node) | 4000 |
| `waypoint-web` | Web Service (Node) | 43123 |
| `waypoint-db` | PostgreSQL | 5432 |

### Steps

1. **Push to GitHub**

2. **Create Render account** → New Blueprint → connect repo

3. **Set environment variables** in Render dashboard:

#### Backend (`waypoint-api`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Auto-set by Render PostgreSQL |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `ELEVENLABS_API_KEY` | No | ElevenLabs TTS (fallback if missing) |
| `CORS_ORIGIN` | Yes | Frontend URL, e.g. `https://waypoint-web.onrender.com` |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `4000` |

#### Frontend (`waypoint-web`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL, e.g. `https://waypoint-api.onrender.com` |

4. **Deploy** — Render builds and deploys both services.

5. **Verify:**
   ```bash
   curl https://waypoint-api.onrender.com/health
   ```

### Cold start note

Render free tier spins down after inactivity. First request may take 30–60s. For demos, hit `/health` before presenting.

---

## ElevenLabs setup

1. Create account at [elevenlabs.io](https://elevenlabs.io)
2. Get API key from Profile → API Keys
3. Set `ELEVENLABS_API_KEY` in backend env
4. Optional: set `ELEVENLABS_VOICE_ID` (default: Rachel)

### Voice features

- **Read next action** — case detail page speaker button
- **Read readiness status** — "You are 80% ready"
- Cached by text hash to reduce API calls and latency

### Without ElevenLabs

If no API key, backend returns `{ fallback: true }` and frontend uses browser Web Speech API.

---

## Local development

```bash
# SQLite (default)
DATABASE_URL="file:./dev.db"

# PostgreSQL (match production)
DATABASE_URL="postgresql://user:pass@localhost:5432/waypoint"
```

---

## Production checklist (post-hackathon)

- [ ] Enable Render paid tier or health-check pinger (avoid cold starts)
- [ ] PostgreSQL backups
- [ ] Encrypt PII at rest
- [ ] HIPAA-compliant infra for real PHI
- [ ] OAuth authentication
- [ ] Rate limiting on API
- [ ] CDN for frontend static assets
- [ ] Error monitoring (Sentry)
