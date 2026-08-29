# Demo script — 2.5 minutes

Wake the services first (free tier sleeps). Then open https://waypoint-web-bw9d.onrender.com.

If the first click is slow, it is a cold start, not a crash.

---

## Line

Waypoint is not a chatbot. You describe a problem; a workflow engine — not the language model — decides what happens next.

---

## Beat 1 — lost ID (≈70s)

1. Speak (once the ElevenLabs key is on Render) or type: **"Nimepoteza kitambulisho changu"** (or "I lost my national ID").
2. A **case** opens against eCitizen / National Registration Bureau, not a chat thread. If you spoke, it reads the next action back.
3. Point at the checklist: police abstract with an OB number, birth certificate, old ID number, parent details, KES 1,000, eCitizen account. Each row says whether it is officially documented or commonly reported.
4. Tick the mandatory items. Readiness only hits **100%** when they are all accounted for. Then it hands you the Huduma Centre step — it does not invent a government API.

Say: *the model classified the sentence. The engine owns the state machine.*

---

## Beat 2 — SHA care navigation (≈50s)

1. New case: **"My chest has been hurting and I feel like I cannot breathe"** (or Kiswahili red-flag phrasing).
2. It **escalates** on an explicit rule list, not a model judgement. Waypoint does not diagnose.
3. Contrast with a non-urgent line if there is time ("my knee has been hurting for 3 weeks in Nairobi") — recommended facility level, Lang’ata / Mbagathi / KNH as curated options.

---

## Beat 3 — why this architecture (≈30s)

Adapters are plug-ins: government today, healthcare today, insurance or education next without rewriting the engine or the UI. The UI renders from step type and mode.

Stack for the brief: **Cursor** to build, **Render** to host, **ElevenLabs** for voice — Scribe v2 in, TTS out.

---

## If something breaks on stage

| Symptom | What to do |
|---|---|
| Spinner, then error on first click | Wait 60s, refresh. Cold start. |
| "Could not start a session" | The API is still on an old CORS build **and** the frontend is not on the `/backend` proxy commit. Redeploy **waypoint-web**. |
| Voice button missing | Paste `ELEVENLABS_API_KEY` on **waypoint-api**, wait for `/health` to show `"voice": true`, hard-refresh the app. |
| Judge asks "is this ChatGPT?" | "No. Keyword classification works without an OpenAI key. Transitions are YAML + a condition grammar." |
