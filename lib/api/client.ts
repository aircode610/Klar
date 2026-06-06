import type {
  ActionListItem,
  ActionStatus,
  ActionUpdate,
  Letter,
  RagQuery,
  RagResponse,
} from "@/types";

/**
 * Typed client for the Klar FastAPI backend. Routers are mounted at /letters,
 * /actions, /rag — no /api prefix, no auth. In mock mode (NEXT_PUBLIC_API_MODE=
 * mock) MSW intercepts these same paths.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  return request<Letter>("/letters", { method: "POST", body: form });
};

export const getLetter = (id: string) => request<Letter>(`/letters/${id}`);

// --- Actions / obligations ------------------------------------------------

export const listActions = (status?: ActionStatus) => {
  const qs = status ? `?status=${status}` : "";
  return request<ActionListItem[]>(`/actions${qs}`);
};

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

// --- Health ---------------------------------------------------------------

export const health = () =>
  request<{ status: string; service: string; model: string }>("/health");
