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

/** Server-computed risk factors behind the 0–100 score (RiskScore breakdown). */
export interface RiskBreakdown {
  score: number;
  deadline_proximity_pts: number;
  institution_weight: number;
  severity_pts: number;
  missing_info_penalty: number;
  explanation: string;
}

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
  /** the factor breakdown behind risk_score, for the "why this risk" view */
  risk?: RiskBreakdown;
  /** 0..1 — how sure the deadline extraction is */
  deadline_confidence?: number;
  deadline_source?: DeadlineSource;
  /** present on GET /letters/{id} and /actions */
  status?: ActionStatus;
  steps?: string[];
  /** exact German sentence the action was extracted from */
  evidence_span?: string;
  reply_needed?: boolean;
  /** Outstanding EUR amount this action requires the user to pay. */
  amount_due_eur?: number | null;
}

/** A single legal citation surfaced by the grounded generator. */
export interface CitationItem {
  /** Legal section reference (German, verbatim): "§ 16 AsylG" */
  section: string;
  /** Why this section applies to the letter (localized prose). */
  text: string;
}

export interface Letter {
  id: string;
  institution: string;
  document_type: string;
  category: DocumentCategory;
  summary_en: string;
  actions: ActionItem[];
  extraction_warnings: string[];
  /** extracted German source text, for the fog-to-clear original view */
  ocr_text?: string | null;
  /** 0..1 overall extraction confidence */
  confidence?: number | null;
  // -- Long-form generated content (populated by the SSE pipeline). Empty
  //    string / empty list is the "not generated" sentinel — never null.
  /** Plain-language explanation of the letter (localized). */
  explanation?: string;
  /** What happens if the user ignores this letter (short narrative). */
  consequence?: string;
  /** Agent's narrative reason for the risk score (e.g. "Deadline was 5 years ago…"). */
  risk_reason?: string;
  /** Documents / items the user should prepare. */
  checklist?: string[];
  /** Legal sections cited by the explanation. */
  citations?: CitationItem[];
  /** Pre-drafted Behördendeutsch reply (always German, regardless of UI lang). */
  response_draft?: string;
}

/** AI-generated Behördendeutsch reply for a letter (POST /letters/{id}/reply). */
export interface ReplyDraft {
  /** the ready-to-send German letter */
  body_text: string;
  /** language of body_text (always "de") */
  language: string;
  /** optional server-rendered PDF */
  download_url?: string | null;
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
  /** Outstanding EUR amount on this action, if any. */
  amount_due_eur?: number | null;
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

/**
 * Login/signup response. Auth is cookie-based: the backend sets an httpOnly
 * session cookie via Set-Cookie; the body just carries the user for display.
 * No token is exposed to JS.
 */
export interface AuthResponse {
  user: AuthUser;
}

export interface AuthCredentials {
  email: string;
  password: string;
}
