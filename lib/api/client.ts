import type {
  ActionListItem,
  ActionStatus,
  ActionUpdate,
  AuthCredentials,
  AuthResponse,
  Letter,
  RagQuery,
  RagResponse,
} from "@/types";
import { useAppStore } from "@/lib/store";

/**
 * Typed client for the Klar FastAPI backend. Routers are mounted at /letters,
 * /actions, /rag — no /api prefix, no auth. In mock mode (NEXT_PUBLIC_API_MODE=
 * mock) MSW intercepts these same paths.
 *
 * Human-readable fields are localized server-side from the `?lang=` query param
 * (the contract's localization mechanism), so content endpoints carry the user's
 * current language.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Current UI language, appended as ?lang= to content requests. */
function lang(): string {
  return useAppStore.getState().lang;
}

/** Append query params to a path, merging with any existing ones. */
function withQuery(path: string, params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return path;
  const qs = entries.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join("&");
  return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const headers = new Headers(init?.headers);
  if (!isForm && init?.body) headers.set("Content-Type", "application/json");

  // Attach the session token when signed in (backend must allow the
  // Authorization header in CORS — see docs/06 §Auth).
  const token = useAppStore.getState().auth?.token;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) message = typeof body.detail === "string" ? body.detail : message;
    } catch {
      /* non-JSON */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Letters --------------------------------------------------------------

/** Upload an image/PDF. Synchronous: returns the fully extracted Letter. */
export const uploadLetter = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return request<Letter>(withQuery("/letters", { lang: lang() }), {
    method: "POST",
    body: form,
  });
};

export const getLetter = (id: string) =>
  request<Letter>(withQuery(`/letters/${id}`, { lang: lang() }));

// --- Actions / obligations ------------------------------------------------

export const listActions = (status?: ActionStatus) =>
  request<ActionListItem[]>(withQuery("/actions", { status, lang: lang() }));

export const updateAction = (id: string, patch: ActionUpdate) =>
  request<{ id: string; status: ActionStatus }>(`/actions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

// --- RAG ------------------------------------------------------------------

export const ragSearch = (query: RagQuery) =>
  request<RagResponse>("/rag/search", {
    method: "POST",
    body: JSON.stringify({ top_k: 4, ...query }),
  });

// --- Auth -----------------------------------------------------------------

export const signup = (creds: AuthCredentials) =>
  request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(creds),
  });

export const login = (creds: AuthCredentials) =>
  request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(creds),
  });

// --- Health ---------------------------------------------------------------

export const health = () =>
  request<{ status: string; service: string; model: string }>("/health");
