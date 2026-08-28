# Deployment

## Render

`render.yaml` at the repository root defines both services and the database.

| Service | Type | Port |
|---|---|---|
| `waypoint-api` | Web service (Node) | 4000 |
| `waypoint-web` | Web service (Node) | 43123 |
| `waypoint-db` | PostgreSQL | — |

### Steps

1. Push the repository to GitHub.
2. Render dashboard → **New** → **Blueprint** → select the repository. Render reads `render.yaml`.
3. Set the variables below. Values marked `sync: false` must be entered by hand.
4. Deploy. The API build swaps in the PostgreSQL schema and runs `prisma db push`.
5. Confirm:

```bash
curl https://waypoint-api.onrender.com/health
```

`capabilities` in the response tells you which optional keys were picked up.

### Backend variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Wired automatically from `waypoint-db` |
| `CORS_ORIGIN` | Yes | The frontend URL exactly, e.g. `https://waypoint-web.onrender.com`. Comma-separated for several |
| `OPENAI_API_KEY` | No | Absent means keyword classification |
| `ELEVENLABS_API_KEY` | No | Absent disables voice input; playback falls back to the device |
| `ELEVENLABS_VOICE_ID` | No | Defaults to Rachel |
| `ELEVENLABS_VOICE_ID_SW` | No | A separate voice for Kiswahili if you want one |

`CORS_ORIGIN` is the usual first-deploy mistake. It must match the frontend origin exactly — no trailing slash.

### Frontend variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | The API URL, e.g. `https://waypoint-api.onrender.com` |

This is inlined at build time, so changing it needs a rebuild, not a restart.

### SQLite locally, PostgreSQL on Render

Two schema files are kept because the provider cannot be set from an environment variable:

- `prisma/schema.prisma` — SQLite, used locally
- `prisma/schema.postgresql.prisma` — PostgreSQL, copied over during the Render build

### Cold starts

Render's free tier sleeps after inactivity and the first request can take 30–60 seconds. Before demonstrating, wake it:

```bash
curl https://waypoint-api.onrender.com/health
```

Then load the frontend once. A cold start in front of an audience reads as a broken app.

---

## ElevenLabs

1. Create an account at [elevenlabs.io](https://elevenlabs.io).
2. Profile → API Keys → copy the key.
3. Set `ELEVENLABS_API_KEY` on the API service.

Two capabilities are used:

- **Scribe** transcribes recordings. It handles sentences that mix English and Kiswahili, which is how people actually speak.
- **Text to speech** reads the next action back. Turbo for English, Multilingual for Kiswahili.

Audio is cached by a hash of text, voice, and model, so repeated playback of the same summary costs one generation.

Without the key the app still works: voice input is hidden, and playback uses the browser's speech synthesis.

---

## Vercel for the frontend

Vercel suits the Next.js side well and avoids frontend cold starts.

1. Import the repository; set the root directory to `frontend`.
2. Set `NEXT_PUBLIC_API_URL` to the Render API URL.
3. Deploy, then add the Vercel URL to `CORS_ORIGIN` on the API and redeploy the API.

The API and database stay on Render.

---

## Before real users

The prototype is not ready to hold real identity documents or health information. Required first:

- Identity verification instead of anonymous sessions
- Encryption at rest for case data and uploads
- Retention and deletion policy, and a lawful basis for holding health data
- Rate limiting and abuse controls
- Uploads moved to object storage with signed, expiring URLs
- Error monitoring
- A review process for curated requirement data, since institutional requirements change without notice
