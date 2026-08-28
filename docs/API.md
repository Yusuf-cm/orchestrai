# API

Base URL: `http://localhost:4000` in development.

Every route under `/api/cases` and `/api/voice` (except `/api/voice/status`) requires a session token:

```
Authorization: Bearer <token>
```

Requests without a valid token return `401`. Cases are scoped to their owner, so a case id on its own grants nothing.

---

## Session

### `POST /api/session`

Mints a session. The client stores the token and reuses it.

```json
{ "name": "Guest" }
```

```json
{ "token": "…", "userId": "…", "name": "Guest" }
```

### `GET /api/session`

Validates the current token. `200` with `{ "valid": true }`, or `401`.

---

## Cases

### `POST /api/cases/start`

```json
{ "utterance": "Nimepoteza kitambulisho changu, niko Nairobi" }
```

Returns `201` with a case positioned at the first step needing the person. Automatic steps have already run.

`400 UNSUPPORTED` if the request falls outside the registered domains — Waypoint says so rather than opening a case it cannot serve.

### `GET /api/cases`

Cases for the session, newest first. Optional `?status=open`.

### `GET /api/cases/:id`

One case, including `audit`.

### `PATCH /api/cases/:id`

Describes what happened. The engine decides whether the case moves.

```json
{
  "satisfyRequirement": "req_police_abstract",
  "unsatisfyRequirement": "req_birth_certificate",
  "confirmStep": true,
  "selectFacility": "fac-langata-hc",
  "scheduleVisit": { "facilityId": "fac-langata-hc", "datetime": "2026-09-01T05:00:00Z" },
  "slots": { "county": "Kisumu" }
}
```

All fields optional. `confirmStep` authorises exactly one transition.

Returns the updated case. If no transition is satisfied the case is returned unchanged — a successful response does not imply movement.

### `POST /api/cases/:id/documents`

`multipart/form-data` with `file` and optional `requirementId`.

JPEG, PNG, WebP, HEIC, or PDF, up to 10 MB. Anything else returns `400 INVALID_UPLOAD`.

The file is recorded against a requirement. Waypoint does not read it or verify it with the institution.

### `POST /api/cases/:id/chat`

```json
{ "message": "What is a police abstract?" }
```

```json
{ "reply": "…", "source": "ai" }
```

`source` is `"fallback"` when the answer came from case data rather than the language model. Answers are grounded in the case's recorded requirements; this endpoint never changes case state.

---

## Voice

### `GET /api/voice/status`

Unauthenticated. `{ "configured": true, "languages": ["en", "sw"] }`.

### `POST /api/voice/transcribe`

`multipart/form-data` with `audio`. Returns `{ "text": "…", "language": "en" }`.

`503` with `{ "fallback": true }` when the voice service is unconfigured, so the client can offer typing instead.

### `POST /api/voice/speak`

```json
{ "caseId": "…", "language": "sw" }
```

Supply `text` to read specific wording, or `caseId` to have the case's next action composed and read.

Returns `audio/mpeg`. The `X-Voice-Cached` header indicates a cache hit.

When unconfigured, returns `200` with `{ "fallback": true, "text": "…" }` and the client uses on-device speech.

---

## Workflows

### `GET /api/workflows`

Loaded definitions with id, title, domain, adapter, version, and step count. Useful for confirming what the server actually validated at boot.

---

## Health

### `GET /health`

```json
{
  "status": "ok",
  "version": "0.2.0",
  "workflows": ["gov.ke_id_replacement_v1", "health.ke_care_navigation_v1"],
  "adapters": ["gov-adapter-v1", "health-adapter-v1"],
  "capabilities": { "languageModel": false, "voice": true }
}
```

`capabilities` reports which optional keys are configured. Neither is required.

---

## Errors

```json
{ "error": "Human-readable sentence.", "code": "UNSUPPORTED" }
```

| Code | Status | Meaning |
|---|---|---|
| `NO_SESSION` | 401 | Missing or expired token |
| `NOT_FOUND` | 404 | Case absent, or not yours |
| `UNSUPPORTED` | 400 | Outside the registered domains |
| `INVALID_UPLOAD` | 400 | Wrong file type or too large |
| `EMPTY` / `TOO_LONG` | 400 | Input failed validation |
| `INTERNAL` | 500 | Unexpected failure |

`error` is written to be shown to a person as-is.
