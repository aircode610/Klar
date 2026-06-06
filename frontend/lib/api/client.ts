import type {
  ActionListItem,
  ActionStatus,
  ActionUpdate,
  AuthCredentials,
  AuthResponse,
  DeadlineItem,
  DocumentCategory,
  Letter,
  LetterListItem,
  LetterStatus,
  LetterUploadResponse,
  RagQuery,
  RagResponse,
  SseEventType,
} from "@/types";
import { useAppStore } from "@/lib/store";

/**
 * Typed client for the Klar FastAPI backend. The rich surface lives under /api;
 * auth is cookie-based, so every request is sent with credentials. The
 * `ngrok-skip-browser-warning` header lets the ngrok tunnel pass JSON straight
 * through (it's harmless against a non-ngrok origin).
 *
 * Human-readable fields are localized server-side from the `?lang=` query param.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const API = `${BASE}/api`;

const COMMON_HEADERS: Record<string, string> = {
  "ngrok-skip-browser-warning": "true",
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function lang(): string {
  return useAppStore.getState().lang;
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return path;
  const qs = entries.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join("&");
  return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const headers = new Headers(init?.headers);
  for (const [k, v] of Object.entries(COMMON_HEADERS)) headers.set(k, v);
  if (!isForm && init?.body) headers.set("Content-Type", "application/json");

  const res = await fetch(url, { ...init, headers, credentials: "include" });

  if (res.status === 401) useAppStore.getState().signOut();
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
      else if (typeof body?.detail === "string") message = body.detail;
    } catch {
      /* non-JSON */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Auth -----------------------------------------------------------------

export const signup = (creds: AuthCredentials) =>
  request<AuthResponse>(`${API}/auth/signup`, { method: "POST", body: JSON.stringify(creds) });

export const login = (creds: AuthCredentials) =>
  request<AuthResponse>(`${API}/auth/login`, { method: "POST", body: JSON.stringify(creds) });

export const logout = () => request<void>(`${API}/auth/logout`, { method: "POST" });

export const me = () => request<AuthResponse>(`${API}/auth/me`);

// --- Letters --------------------------------------------------------------

/** Upload an image/PDF. Returns immediately with the new letter id. */
export const uploadLetter = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return request<LetterUploadResponse>(
    withQuery(`${API}/letters/upload`, { lang: lang() }),
    { method: "POST", body: form },
  );
};

export const getLetter = (id: string) =>
  request<Letter>(withQuery(`${API}/letters/${id}`, { lang: lang() }));

export const listLetters = (params?: { status?: LetterStatus; category?: DocumentCategory }) =>
  request<LetterListItem[]>(
    withQuery(`${API}/letters`, { status: params?.status, category: params?.category }),
  );

// --- SSE pipeline ---------------------------------------------------------

/**
 * Open the SSE pipeline for a letter. Parses the `event:`/`data:` frames and
 * calls `onEvent` per frame. Uses fetch + ReadableStream (not EventSource) so
 * the session cookie AND the ngrok-skip header both travel. Resolves when the
 * stream ends (`done`/`error`/EOF). Pass an AbortSignal to cancel.
 */
export async function processLetter(
  id: string,
  onEvent: (type: SseEventType, data: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(withQuery(`${API}/letters/${id}/process`, { lang: lang() }), {
    method: "GET",
    headers: { ...COMMON_HEADERS, Accept: "text/event-stream" },
    credentials: "include",
    signal,
  });
  if (res.status === 401) useAppStore.getState().signOut();
  if (!res.ok || !res.body) throw new ApiError(res.status, "Processing stream failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const ev = parseFrame(frame);
      if (ev) onEvent(ev.type, ev.data);
    }
  }
}

function parseFrame(frame: string): { type: SseEventType; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try {
    return { type: event as SseEventType, data: JSON.parse(raw) };
  } catch {
    return { type: event as SseEventType, data: raw };
  }
}

// --- Actions / deadlines --------------------------------------------------

export const listActions = (status?: ActionStatus) =>
  request<ActionListItem[]>(withQuery(`${API}/actions`, { status }));

export const updateAction = (id: string, patch: ActionUpdate) =>
  request<{ id: string; status: ActionStatus }>(`${API}/actions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const getDeadlines = () => request<DeadlineItem[]>(`${API}/deadlines`);

// --- RAG ------------------------------------------------------------------

export const ragSearch = (query: RagQuery) =>
  request<RagResponse>(`${API}/rag/search`, {
    method: "POST",
    body: JSON.stringify({ top_k: 4, ...query }),
  });

// --- Health (root, not /api) ----------------------------------------------

export const health = () =>
  request<{ status: string; service: string; model: string }>(`${BASE}/health`);
