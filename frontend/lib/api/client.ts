import type {
  ActionListItem,
  ActionStatus,
  ActionUpdate,
  AuthCredentials,
  AuthResponse,
  Letter,
  RagQuery,
  RagResponse,
  ReplyDraft,
} from "@/types";
import { useAppStore } from "@/lib/store";

/**
 * Typed client for the Klar FastAPI backend. Routers are mounted at /letters,
 * /actions, /rag — no /api prefix. Auth is cookie-based (credentials:"include").
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

  // Cookie-based auth: send the httpOnly session cookie with every request.
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    // Session expired/rejected — drop the local session so the app re-gates.
    useAppStore.getState().signOut();
  }
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

/**
 * Discriminated union of every event type the backend SSE pipeline emits.
 * The pipeline (backend's app/pipeline/orchestrator.py) chains the AI team's
 * OCR → ReAct agent → RAG retrieval → grounded generator, emitting one
 * event per stage. UI can render any subset live.
 */
export type LetterProgressEvent =
  | { type: "ocr_result";     data: { text: string } }
  | { type: "classification"; data: { type: string; category: string; agency: string; category_confidence?: number } }
  | { type: "risk_score";     data: { score: number; label: string } }
  | { type: "deadline";       data: { date: string | null; days_remaining: number | null; note?: string } }
  | { type: "consequence";    data: { text: string } }
  | { type: "explanation";    data: { chunk: string } }     // streaming, many frames
  | { type: "response_draft"; data: { chunk: string } }     // streaming, many frames
  | { type: "checklist";      data: { items: string[] } }
  | { type: "citations";      data: { items: { section: string; text: string; score?: number }[] } }
  | { type: "done";           data: { letter_id: string } }
  | { type: "error";          data: { code?: string; message?: string; detail?: string } };

/**
 * Upload an image/PDF and stream the AI pipeline live.
 *
 * Two-step flow under the hood:
 *   1. `POST /letters/upload` (multipart) → `{ letter_id }`  (~50ms)
 *   2. `EventSource /letters/{id}/process` → live progress events  (~20-30s)
 *      After the `done` event we fetch the final Letter and resolve.
 *
 * The optional `onEvent` callback fires for every SSE frame as it arrives
 * — pass it in if the UI wants to show "AI thinking" stages live.
 */
export const uploadLetter = (
  file: File,
  onEvent?: (e: LetterProgressEvent) => void,
): Promise<Letter> => {
  return new Promise<Letter>((resolve, reject) => {
    (async () => {
      try {
        // Step 1: upload, get letter_id
        const form = new FormData();
        form.append("file", file);
        const { letter_id } = await request<{ letter_id: string }>(
          withQuery("/letters/upload", { lang: lang() }),
          { method: "POST", body: form },
        );

        // Step 2: open SSE and accumulate events until `done` or `error`
        const sseUrl = `${BASE}${withQuery(`/letters/${letter_id}/process`, { lang: lang() })}`;
        const es = new EventSource(sseUrl, { withCredentials: true });

        const KNOWN: LetterProgressEvent["type"][] = [
          "ocr_result", "classification", "risk_score", "deadline", "consequence",
          "explanation", "response_draft", "checklist", "citations", "done", "error",
        ];

        let settled = false;
        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          es.close();
          fn();
        };

        for (const t of KNOWN) {
          es.addEventListener(t, async (raw) => {
            try {
              const data = JSON.parse((raw as MessageEvent).data);
              onEvent?.({ type: t, data } as LetterProgressEvent);

              if (t === "done") {
                try {
                  const letter = await getLetter(data.letter_id);
                  finish(() => resolve(letter));
                } catch (err) {
                  finish(() => reject(err));
                }
              } else if (t === "error") {
                const msg = data?.message || data?.detail || "Extraction failed";
                finish(() => reject(new ApiError(502, msg)));
              }
            } catch (err) {
              // Malformed event payload — surface but keep listening
              console.warn("SSE event parse failed", t, err);
            }
          });
        }

        // Network-level EventSource error (connection dropped, 4xx on the
        // initial GET, etc.). EventSource auto-reconnects on transient
        // errors so only treat as fatal if we haven't settled yet AND the
        // stream is in CLOSED state.
        es.onerror = () => {
          if (es.readyState === EventSource.CLOSED) {
            finish(() => reject(new ApiError(0, "Stream closed before completing")));
          }
        };
      } catch (err) {
        reject(err);
      }
    })();
  });
};

export const getLetter = (id: string) =>
  request<Letter>(withQuery(`/letters/${id}`, { lang: lang() }));

/** Generate the done-for-you Behördendeutsch reply for a letter. */
export const generateReply = (
  id: string,
  body: { action_id?: string; applicant?: Record<string, string> } = {},
) =>
  request<ReplyDraft>(withQuery(`/letters/${id}/reply`, { lang: lang() }), {
    method: "POST",
    body: JSON.stringify(body),
  });

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

// --- Auth (cookie-based) --------------------------------------------------

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

/** Clears the backend session cookie. */
export const logout = () => request<void>("/auth/logout", { method: "POST" });

// --- Health ---------------------------------------------------------------

export const health = () =>
  request<{ status: string; service: string; model: string }>("/health");
