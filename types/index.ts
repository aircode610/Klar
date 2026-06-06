/**
 * Klar API contract — mirrors the implemented FastAPI backend (backend-dev).
 *
 * The product is obligation-centric: a Letter is extracted into structured
 * ActionItems, each with a deadline, severity, server-computed risk score, steps,
 * and the exact German evidence span it came from. There is no auth, no SSE, no
 * payments — upload is synchronous and returns the full structured result.
 *
 * Endpoints (base = NEXT_PUBLIC_API_URL):
 *   POST   /letters            (multipart `file`) -> Letter
 *   GET    /letters/{id}                          -> Letter
 *   GET    /actions?status=                       -> ActionListItem[]
 *   PATCH  /actions/{id}        { status?, ... }   -> { id, status }
 *   POST   /rag/search          RagQuery           -> RagResponse
 *   GET    /health
 */

export type ISODate = string;

export type Severity = "critical" | "high" | "medium" | "low";

export type ActionStatus = "open" | "done" | "ignored";

export type DeadlineSource = "explicit" | "inferred" | "unknown";

/** Closed classification vocabulary (backend DocumentCategory enum). */
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
  /** present on GET /letters/{id} actions and /letters upload response */
  description?: string;
  /** ISO date (YYYY-MM-DD) or null if none */
  deadline: ISODate | null;
  severity: Severity;
  /** server-computed 0–100; present on the upload response */
  risk_score?: number;
  /** present on GET /letters/{id} and /actions */
  status?: ActionStatus;
  steps?: string[];
  /** exact German sentence the action was extracted from */
  evidence_span?: string;
  reply_needed?: boolean;
}

export interface Letter {
  id: string;
  institution: string;
  document_type: string;
  category: DocumentCategory;
  summary_en: string;
  actions: ActionItem[];
  extraction_warnings: string[];
}

/** Flat action row from GET /actions (joins back to its letter). */
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

/** A computed, display-ready deadline used by chips and the calendar. */
export interface DeadlineView {
  date: ISODate | null;
  label: string;
  urgency: Urgency;
  daysRemaining: number | null;
}

export type Lang = "en" | "de" | "fa" | "tr" | "ar" | "uk";

// --- Auth -----------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface AuthCredentials {
  email: string;
  password: string;
}
