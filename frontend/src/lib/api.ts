import type { CaseData } from "@waypoint/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export async function startCase(utterance: string): Promise<CaseData> {
  return fetchApi<CaseData>("/api/cases/start", {
    method: "POST",
    body: JSON.stringify({ utterance, userId: "demo-user" }),
  });
}

export async function listCases(): Promise<CaseData[]> {
  const data = await fetchApi<{ cases: CaseData[] }>("/api/cases?userId=demo-user");
  return data.cases;
}

export async function getCase(id: string): Promise<CaseData & { audit?: unknown[] }> {
  return fetchApi(`/api/cases/${id}`);
}

export async function updateCase(
  id: string,
  body: Record<string, unknown>
): Promise<CaseData> {
  return fetchApi<CaseData>(`/api/cases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function uploadDocument(
  caseId: string,
  file: File,
  requirementId?: string
): Promise<{ case: CaseData }> {
  const form = new FormData();
  form.append("file", file);
  if (requirementId) form.append("requirementId", requirementId);

  const res = await fetch(`${API_URL}/api/cases/${caseId}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function chatCase(caseId: string, message: string) {
  return fetchApi<{ reply: string; case: CaseData }>(`/api/cases/${caseId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function speakText(text: string, caseId?: string): Promise<Blob | null> {
  const res = await fetch(`${API_URL}/api/voice/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, caseId }),
  });

  if (res.headers.get("content-type")?.includes("audio")) {
    return res.blob();
  }

  const data = await res.json();
  if (data.fallback && typeof window !== "undefined" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(data.text || text);
    window.speechSynthesis.speak(utterance);
  }
  return null;
}
