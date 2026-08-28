# API Reference

Base URL: `http://localhost:4000` (dev) | `https://waypoint-api.onrender.com` (prod)

## Health

### `GET /health`

```json
{ "status": "ok", "version": "0.1.0", "timestamp": "2026-08-28T..." }
```

---

## Cases

### `POST /api/cases/start`

Start a new case from natural language.

**Body:**
```json
{
  "utterance": "I lost my California driver's license",
  "userId": "demo-user"
}
```

**Response:** `201` — Full case object with workflow state, requirements (if resolved), current step.

---

### `GET /api/cases`

List cases for a user.

**Query:** `?userId=demo-user&status=open`

**Response:** `200` — `{ cases: Case[] }`

---

### `GET /api/cases/:id`

Get case by ID.

**Response:** `200` — Case object with requirements, artifacts, audit tail.

---

### `PATCH /api/cases/:id`

Update case slots or mark step complete.

**Body:**
```json
{
  "slots": { "zip_code": "90210" },
  "confirmStep": true,
  "satisfyRequirement": "req_residency_2"
}
```

**Response:** `200` — Updated case. Engine validates all changes.

---

### `POST /api/cases/:id/advance`

Propose workflow advancement (engine-gated).

**Body:**
```json
{
  "action": "user_confirms",
  "payload": {}
}
```

**Response:**
```json
{
  "allowed": true,
  "case": { ... },
  "message": "Advanced to readiness_check"
}
```

If not allowed:
```json
{
  "allowed": false,
  "reason": "Requirements pending",
  "case": { ... }
}
```

---

### `POST /api/cases/:id/upload`

Upload document artifact.

**Body:** `multipart/form-data` — `file`, optional `requirementId`

**Response:** `201` — `{ artifact, case }` with updated readiness.

---

### `POST /api/cases/:id/chat`

AI clarification (streaming SSE).

**Body:**
```json
{
  "message": "What counts as proof of residency?"
}
```

**Response:** `text/event-stream` — chunks of assistant text. Engine state included in final event.

---

## Voice (ElevenLabs)

### `POST /api/voice/speak`

Convert text to speech.

**Body:**
```json
{
  "text": "You need one more proof of residency document.",
  "caseId": "optional-for-caching"
}
```

**Response:** `200` — `audio/mpeg` stream.

**Fallback:** If `ELEVENLABS_API_KEY` missing, returns `{ fallback: true, text }` and frontend uses Web Speech API.

---

## Workflows (debug)

### `GET /api/workflows`

List loaded workflow definitions.

### `GET /api/workflows/:id`

Get workflow definition by ID.

---

## Error format

```json
{
  "error": "Human-readable message",
  "code": "REQUIREMENT_NOT_SATISFIED",
  "details": {}
}
```

## Status codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Invalid request / engine rejected |
| 404 | Case not found |
| 500 | Server error |
