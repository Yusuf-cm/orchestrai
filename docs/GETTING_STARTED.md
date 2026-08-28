# Getting Started — Step by Step

Follow these steps to run Waypoint locally and deploy to Render.

## Step 1: Install dependencies

```bash
git clone <repo-url>
cd waypoint
npm install
```

## Step 2: Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Add your API keys to `backend/.env`:

| Key | Required | Get it from |
|-----|----------|-------------|
| `OPENAI_API_KEY` | Recommended | platform.openai.com |
| `ELEVENLABS_API_KEY` | Optional | elevenlabs.io → Profile → API Keys |

## Step 3: Initialize database

```bash
npm run db:push
npm run db:seed
```

## Step 4: Run milestone tests

```bash
npm run test:milestone
```

Expected: **8 tests passing**

## Step 5: Start development servers

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:43123 |
| Backend API | http://localhost:4000 |
| Health check | http://localhost:4000/health |

## Step 6: Try the demo flows

### Government — Lost ID

1. Open http://localhost:43123
2. Click **"I lost my California driver's license"** or type it
3. See requirements with **Official** / **Community** badges
4. Go to **Documents** tab
5. Upload files named `passport.pdf`, `utility-bill.pdf`, `bank-statement.pdf`
6. Watch readiness hit **100% — Ready to go**
7. Click **Listen** for ElevenLabs voice readout

### Healthcare — Knee pain

1. Start new case: **"My knee has been hurting for 3 weeks when I run"**
2. See safety disclaimer banner
3. View care recommendation (not a diagnosis)
4. Select a provider from the list
5. Book appointment → see visit prep

## Step 7: Deploy to Render

1. Push repo to GitHub
2. Render Dashboard → **New Blueprint** → connect repo
3. Set secrets:
   - `OPENAI_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `CORS_ORIGIN` = your frontend URL
   - `NEXT_PUBLIC_API_URL` = your backend URL
4. Deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for details.

## Milestone checklist

- [x] M0: Scaffold + docs
- [x] M1: Shared types + database
- [x] M2: Workflow engine
- [x] M3: Gov + health adapters
- [x] M4: API + AI + ElevenLabs
- [x] M5: Frontend UI
- [x] M6: Render config

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `EADDRINUSE` on port 4000 | Kill existing process: `lsof -ti:4000 \| xargs kill` |
| Frontend can't reach API | Check `NEXT_PUBLIC_API_URL` in `.env.local` |
| Voice not working | Set `ELEVENLABS_API_KEY` or use browser TTS fallback |
| Render cold start slow | Hit `/health` before demo |
