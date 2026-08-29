# Deployment

## Live demo (Cursor Kenya Build Night)

| Service | URL |
|---|---|
| App | https://waypoint-web-bw9d.onrender.com |
| API | https://waypoint-api-xh6v.onrender.com |
| Health | https://waypoint-api-xh6v.onrender.com/health |

The browser talks to the app origin only (`/backend/...`). Next.js proxies those calls to the API and strips the `Origin` header, so a CORS mismatch on the API cannot blank the UI.

A healthy API reports `"version": "0.2.1"` and an `allowedOrigins` array. `"version": "0.2.0"` without `allowedOrigins` is an older deploy: the proxy still works after the **frontend** is on this commit, but set `CORS_ORIGIN` and redeploy the API anyway.

### If the live site still fails to start a case

1. Render → **waypoint-web** → **Manual Deploy** → latest `main`.
2. Render → **waypoint-api** → Environment → `CORS_ORIGIN` = `https://waypoint-web-bw9d.onrender.com` (no trailing slash) → **Save** → **Manual Deploy**.
3. Optional: `ELEVENLABS_API_KEY` on **waypoint-api** for Scribe + TTS in front of judges.

Wake both services before presenting. Free-tier cold start is 30–60 seconds:

```bash
curl https://waypoint-api-xh6v.onrender.com/health
curl -I https://waypoint-web-bw9d.onrender.com
```

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
curl https://waypoint-api-xh6v.onrender.com/health
```

`capabilities` in the response tells you which optional keys were picked up. After this commit you should also see `version` and `allowedOrigins`.

### Backend variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Wired automatically from `waypoint-db` |
| `CORS_ORIGIN` | Yes | Frontend origin, e.g. `https://waypoint-web-bw9d.onrender.com`. Wildcards such as `https://*.onrender.com` are supported. Comma-separated for several. The API also always allows `https://*.onrender.com` and localhost so a generated hostname cannot take the demo down. |
| `OPENAI_API_KEY` | No | Absent means keyword classification |
| `ELEVENLABS_API_KEY` | No | Absent disables voice input; playback falls back to the device |
| `ELEVENLABS_VOICE_ID` | No | Defaults to Rachel |
| `ELEVENLABS_VOICE_ID_SW` | No | A separate voice for Kiswahili if you want one |

Older API builds threw HTTP 500 when `Origin` did not match `CORS_ORIGIN` exactly. Current builds reject quietly (no `Access-Control-Allow-Origin`) and never 500 for that reason.

### Frontend variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | The API URL, e.g. `https://waypoint-api-xh6v.onrender.com` |

This is inlined at **build** time. The browser does not call it directly: the Next.js `/backend` route uses it as the proxy target. Changing it still needs a frontend rebuild.

### SQLite locally, PostgreSQL on Render

Two schema files are kept because the provider cannot be set from an environment variable:

- `prisma/schema.prisma` — SQLite, used locally
- `prisma/schema.postgresql.prisma` — PostgreSQL, copied over during the Render build

### Cold starts

Render's free tier sleeps after inactivity and the first request can take 30–60 seconds. Before demonstrating, wake it:

```bash
curl https://waypoint-api-xh6v.onrender.com/health
```

Then load the frontend once. A cold start in front of an audience reads as a broken app.

---

## ElevenLabs

Voice is already wired. The live API reports `"voice": false` until this key is set — I cannot put it on Render from here.

1. Create a key at [elevenlabs.io/app/developers/api-keys](https://elevenlabs.io/app/developers/api-keys) (free tier is enough for the demo).
2. Render dashboard → **waypoint-api** → **Environment** → `ELEVENLABS_API_KEY` → paste → **Save Changes**. Saving restarts the API.
3. Wait until health shows voice on:

```bash
curl https://waypoint-api-xh6v.onrender.com/health
```

You want `"voice": true` inside `capabilities`. The frontend does not need a rebuild; the mic appears on the next refresh.

4. Optional locally: put the same key in `backend/.env` as `ELEVENLABS_API_KEY=` and restart `npm run dev`.

What the key turns on:

- **Scribe v2** transcribes the home-screen recording. Kenyan terms (kitambulisho, Huduma, eCitizen, SHA, M-Pesa) are passed as keyterms so mixed English/Kiswahili still lands.
- **Text to speech** reads the next action when a spoken case opens, and whenever you tap **Listen**. English uses Flash; Kiswahili uses v3, which is the model that actually speaks Swahili.

Audio is cached by text + voice + model. A cache miss on Render still returns the clip; a disk write failure does not.

Without the key the app still works: the home screen stays on typing, and **Listen** uses the browser's speech synthesis.

---

## Vercel for the frontend

Vercel suits the Next.js side well and avoids frontend cold starts.

1. Import the repository; set the root directory to `frontend`.
2. Set `NEXT_PUBLIC_API_URL` to the Render API URL (`https://waypoint-api-xh6v.onrender.com`).
3. Deploy. The browser uses `/backend` on the Next.js host, so CORS is not required for that path. Still add the Vercel origin to `CORS_ORIGIN` if anything calls the API directly.

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
