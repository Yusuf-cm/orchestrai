import type { CaseView, Language } from "@waypoint/shared";

/**
 * In the browser, every call is same-origin `/backend`. Never fetch
 * NEXT_PUBLIC_API_URL from the client — a wrong baked host
 * (`https://waypoint-api.onrender.com`) 404s with no CORS headers.
 */
const TOKEN_KEY = "waypoint.session";
const NETWORK_ERROR =
  "Could not reach Waypoint. Wait 30 seconds for the API to wake, then refresh.";

/**
 * The browser never calls the API origin. Render baked
 * `https://waypoint-api.onrender.com` into an old frontend build; that host
 * 404s (`x-render-routing: no-server`) with no CORS headers. Same-origin
 * `/backend` is the only URL the page is allowed to fetch.
 */
function bases(): string[] {
  if (typeof window === "undefined") {
    const direct = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    return [direct || "http://127.0.0.1:4000"];
  }
  return ["/backend"];
}

async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  const urls = bases().map((base) => `${base}${path}`);

  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch(urls[i], init);
      if (res.status === 502 && i < urls.length - 1) continue;
      return res;
    } catch {
      // Try the next base (proxy → public API).
    }
  }

  throw new Error(NETWORK_ERROR);
}

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

  const res = await fetchApi("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Could not start a session");

  const payload = (await res.json()) as { token?: string };
  if (!payload.token) throw new Error("Could not start a session");
  storeToken(payload.token);
  return payload.token;
}

export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const token = await ensureSession();
  let res: Response;
  try {
    res = await fetchApi(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
  } catch (err) {
    if (retry && typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
      return request<T>(path, init, false);
    }
    throw err instanceof Error ? err : new Error(NETWORK_ERROR);
  }

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

  const res = await fetchApi(`/api/cases/${caseId}/documents`, {
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
  try {
    const res = await fetchApi("/api/voice/status");
    if (!res.ok) return { configured: false };
    return res.json();
  } catch {
    return { configured: false };
  }
}

/** Sends a recording to ElevenLabs Scribe and returns the transcript. */
export async function transcribeAudio(
  blob: Blob
): Promise<{ text: string; language?: Language }> {
  const token = await ensureSession();
  const form = new FormData();
  form.append("audio", blob, "recording.webm");

  const res = await fetchApi("/api/voice/transcribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? "Could not transcribe audio", body.code, res.status);
  }
  return res.json() as Promise<{ text: string; language?: Language }>;
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
  const res = await fetchApi("/api/voice/speak", {
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
