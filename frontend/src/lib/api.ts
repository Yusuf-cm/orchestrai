import type { CaseView, Language } from "@waypoint/shared";

/**
 * In the browser, every call goes through the Next.js `/backend` proxy so a
 * CORS mismatch on the separately hosted API cannot take the demo down.
 * Server-side code still talks to the API directly.
 */
function apiBase(): string {
  if (typeof window !== "undefined") return "/backend";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}
const TOKEN_KEY = "waypoint.session";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function storeToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Cases hold identity and health details, so every request carries a session
 * token. One is minted on first visit and reused afterwards.
 */
async function ensureSession(): Promise<string> {
  const existing = readToken();
  if (existing) return existing;

  const res = await fetch(`${apiBase()}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Could not start a session");

  const { token } = (await res.json()) as { token: string };
  storeToken(token);
  return token;
}

export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const token = await ensureSession();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  // A stale token means the server restarted; mint a fresh one and retry once.
  if (res.status === 401 && retry) {
    window.localStorage.removeItem(TOKEN_KEY);
    return request<T>(path, init, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? "Request failed", body.code, res.status);
  }
  return res.json();
}

export function startCase(utterance: string): Promise<CaseView> {
  return request<CaseView>("/api/cases/start", {
    method: "POST",
    body: JSON.stringify({ utterance }),
  });
}

export async function listCases(): Promise<CaseView[]> {
  const { cases } = await request<{ cases: CaseView[] }>("/api/cases");
  return cases;
}

export function getCase(id: string): Promise<CaseView> {
  return request<CaseView>(`/api/cases/${id}`);
}

export interface CasePatch {
  slots?: Record<string, unknown>;
  confirmStep?: boolean;
  satisfyRequirement?: string;
  unsatisfyRequirement?: string;
  selectFacility?: string;
  scheduleVisit?: { facilityId: string; datetime: string };
}

export function patchCase(id: string, body: CasePatch): Promise<CaseView> {
  return request<CaseView>(`/api/cases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function uploadDocument(
  caseId: string,
  file: File,
  requirementId?: string
): Promise<CaseView> {
  const token = await ensureSession();
  const form = new FormData();
  form.append("file", file);
  if (requirementId) form.append("requirementId", requirementId);

  const res = await fetch(`${apiBase()}/api/cases/${caseId}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? "Upload failed", body.code, res.status);
  }
  return res.json();
}

export function askQuestion(
  caseId: string,
  message: string
): Promise<{ reply: string; source: "ai" | "fallback" }> {
  return request(`/api/cases/${caseId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function voiceStatus(): Promise<{ configured: boolean }> {
  const res = await fetch(`${apiBase()}/api/voice/status`);
  if (!res.ok) return { configured: false };
  return res.json();
}

/** Sends a recording to ElevenLabs Scribe and returns the transcript. */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const token = await ensureSession();
  const form = new FormData();
  form.append("audio", blob, "recording.webm");

  const res = await fetch(`${apiBase()}/api/voice/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? "Could not transcribe audio", body.code, res.status);
  }
  const { text } = (await res.json()) as { text: string };
  return text;
}

/**
 * Plays a case summary aloud. Falls back to on-device synthesis when the voice
 * service is unavailable so the feature degrades instead of disappearing.
 */
export async function speakCase(
  caseId: string | undefined,
  text: string,
  language: Language = "en"
): Promise<HTMLAudioElement | null> {
  const token = await ensureSession();
  const res = await fetch(`${apiBase()}/api/voice/speak`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ caseId, text, language }),
  });

  if (res.headers.get("content-type")?.includes("audio")) {
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    await audio.play();
    return audio;
  }

  const data = await res.json().catch(() => ({}));
  const spoken = (data.text as string) || text;
  if (typeof window !== "undefined" && "speechSynthesis" in window && spoken) {
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = language === "sw" ? "sw-KE" : "en-KE";
    window.speechSynthesis.speak(utterance);
  }
  return null;
}
