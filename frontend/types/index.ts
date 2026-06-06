/**
 * Klar API contract — mirrors the implemented FastAPI backend (`/api/*`).
 *
 * Flow: upload returns a letter id immediately; the AI pipeline runs via the
 * SSE endpoint GET /api/letters/{id}/process, then GET /api/letters/{id} returns
 * the fully-populated letter. Auth is cookie-based.
 *
 * Endpoints (base = NEXT_PUBLIC_API_URL, all under /api except /health):
 *   POST   /api/auth/signup|login            -> { user }  (+ Set-Cookie)
 *   POST   /api/auth/logout                  -> 204
 *   GET    /api/auth/me                       -> { user }  (401 if signed out)
 *   POST   /api/letters/upload  (multipart)  -> { letter_id }
 *   GET    /api/letters/{id}/process?lang=    -> text/event-stream (SSE)
 *   GET    /api/letters/{id}                  -> Letter
 *   GET    /api/letters?status=&category=     -> LetterListItem[]
 *   GET    /api/deadlines                     -> DeadlineItem[]
 *   GET    /api/actions?status=               -> ActionListItem[]
 *   PATCH  /api/actions/{id}                  -> { id, status }
 *   POST   /api/rag/search                    -> { hits }
 *   GET    /health
 */

export type ISODate = string;

export type Severity = "critical" | "high" | "medium" | "low";
export type ActionStatus = "open" | "done" | "ignored";
export type DeadlineSource = "explicit" | "inferred" | "unknown";
export type LetterStatus = "uploaded" | "processing" | "completed" | "error";

export type DocumentCategory =
  | "health_insurance"
  | "other_insurance"
  | "banking"
  | "tax"
  | "immigration"
  | "education"
  | "housing"
  | "utilities"
  | "employment"
  | "government_benefits"
  | "pension"
  | "broadcast_fee"
  | "civic"
  | "legal_debt"
  | "other";

/** UI-only urgency derived from deadline proximity (drives colours). */
export type Urgency = "overdue" | "urgent" | "soon" | "normal" | "info";

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  deadline: ISODate | null; // YYYY-MM-DD | null
  deadline_source?: DeadlineSource;
  deadline_confidence?: number; // 0..1
  severity: Severity;
  status?: ActionStatus;
  steps?: string[];
  reply_needed?: boolean;
  evidence_span?: string; // exact German source sentence
}

export interface Citation {
  section: string;
  text: string;
  score?: number;
}

export interface Letter {
  id: string;
  institution: string;
  document_type: string;
  letter_type: string;
  category: DocumentCategory;
  summary: string; // localized plain-language summary
  language: string;
  risk_score: number; // 0..100 (letter-level)
  deadline_date: ISODate | null;
  explanation: string; // long-form, localized (filled by /process)
  response_draft: string; // German Behördendeutsch reply (filled by /process)
  checklist: string[];
  citations: Citation[];
  consequence: string;
  status: LetterStatus;
  processed_at: ISODate | null;
  created_at: ISODate;
  actions: ActionItem[];
  extraction_warnings: string[];
  /** captured client-side from the SSE `ocr_result` event (not in GET response) */
  ocr_text?: string | null;
}

/** Compact row from GET /api/letters. */
export interface LetterListItem {
  id: string;
  letter_type: string;
  category: DocumentCategory;
  risk_score: number;
  deadline_date: ISODate | null;
  status: LetterStatus;
  created_at: ISODate;
}

/** GET /api/deadlines item (a view over an action). */
export interface DeadlineItem {
  id: string;
  letter_id: string;
  title: string;
  due_date: ISODate;
  status: ActionStatus;
  risk_score: number;
  severity: Severity;
  category: DocumentCategory;
}

export interface LetterUploadResponse {
  letter_id: string;
}

/** Flat action row from GET /api/actions. */
export interface ActionListItem {
  id: string;
  letter_id: string;
  title: string;
  deadline: ISODate | null;
  severity: Severity;
  status: ActionStatus;
  reply_needed: boolean;
}

export interface ActionUpdate {
  status?: ActionStatus;
  deadline?: ISODate;
  title?: string;
  description?: string;
}

// --- SSE pipeline events (GET /api/letters/{id}/process) ------------------

export type SseEventType =
  | "ocr_result"
  | "classification"
  | "risk_score"
  | "deadline"
  | "consequence"
  | "explanation"
  | "response_draft"
  | "checklist"
  | "citations"
  | "done"
  | "error";

export interface SseEvent {
  type: SseEventType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

// --- RAG ------------------------------------------------------------------

export interface RagQuery {
  query: string;
  top_k?: number;
  institution?: string;
}

export interface RagHit {
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface RagResponse {
  hits: RagHit[];
}

// --- UI view helpers ------------------------------------------------------

export interface DeadlineView {
  date: ISODate | null;
  label: string;
  urgency: Urgency;
  daysRemaining: number | null;
}

export type Lang = "en" | "de" | "fa" | "tr" | "ar" | "uk";

// --- Auth (cookie-based) --------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface AuthCredentials {
  email: string;
  password: string;
}
