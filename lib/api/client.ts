import type {
  AppConfig,
  CheckoutResponse,
  CheckoutTarget,
  DeadlinesResponse,
  Lang,
  Letter,
  LettersPage,
  Me,
  PaymentStatusResponse,
  SessionResponse,
  ApiErrorBody,
} from "@/types";
import { useAppStore } from "@/lib/store";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
const V1 = `${BASE}/v1`;

/** Thrown on any non-2xx response, carrying the localised error envelope. */
export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const { sessionToken, lang } = useAppStore.getState();
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
  headers.set("Accept-Language", lang);
  return headers;
}

async function parseError(res: Response): Promise<never> {
  let code = "INTERNAL";
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error) {
      code = body.error.code;
      message = body.error.message;
    }
  } catch {
    /* non-JSON error body — keep defaults */
  }
  throw new ApiError(res.status, code, message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const headers = authHeaders(init?.headers);
  if (!isFormData && init?.body) headers.set("Content-Type", "application/json");

  const res = await fetch(`${V1}${path}`, { ...init, headers });
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Session & config ----------------------------------------------------

export const createSession = () =>
  request<SessionResponse>("/session", { method: "POST" });

export const getConfig = () => request<AppConfig>("/config");

export const getMe = () => request<Me>("/me");

export const updateMe = (body: { language?: Lang }) =>
  request<Me>("/me", { method: "PATCH", body: JSON.stringify(body) });

// --- Documents -----------------------------------------------------------

export const uploadDocument = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return request<Letter>("/documents", { method: "POST", body: form });
};

export const getDocument = (id: string) =>
  request<Letter>(`/documents/${id}`);

export const listDocuments = (params?: { limit?: number; cursor?: string }) => {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.cursor) q.set("cursor", params.cursor);
  const qs = q.toString();
  return request<LettersPage>(`/documents${qs ? `?${qs}` : ""}`);
};

export const deleteDocument = (id: string) =>
  request<void>(`/documents/${id}`, { method: "DELETE" });

export const generateOutput = (id: string) =>
  request<Letter>(`/documents/${id}/output`, { method: "POST" });

export const patchDocument = (id: string, body: { handled?: boolean }) =>
  request<Letter>(`/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

// --- Deadlines -----------------------------------------------------------

export const getDeadlines = () => request<DeadlinesResponse>("/deadlines");

export const setReminder = (id: string, enabled: boolean) =>
  request<void>(`/documents/${id}/reminder`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });

// --- Payments (Mollie) ---------------------------------------------------

export const checkout = (target: CheckoutTarget) =>
  request<CheckoutResponse>("/payments/checkout", {
    method: "POST",
    body: JSON.stringify(target),
  });

export const getPayment = (paymentId: string) =>
  request<PaymentStatusResponse>(`/payments/${paymentId}`);
