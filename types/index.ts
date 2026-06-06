/**
 * Klar API contract — the shared source of truth between frontend and backend.
 * Mirrors CLAUDE.md Section 7 exactly. Do not diverge without updating the spec.
 *
 * All human-readable fields (summary, whatItWants, consequence, action labels,
 * plan names/features) arrive already localised per the request's Accept-Language.
 * Source German is preserved separately in `originalText`.
 */

export type ISODate = string;

export type Money = { amount: number; currency: 'EUR' };

export type Lang = 'en' | 'de' | 'fa' | 'tr' | 'ar' | 'uk';

export type DocumentStatus = 'processing' | 'ready' | 'failed';

export type Urgency = 'overdue' | 'urgent' | 'soon' | 'normal' | 'info';

export type OutputType = 'reply_letter' | 'filled_form' | 'none';

export interface Deadline {
  /** null if the letter has no deadline */
  date: ISODate | null;
  /** localised, e.g. "Reply by 14 March" */
  label: string;
  urgency: Urgency;
  daysRemaining: number | null;
}

export interface ActionItem {
  id: string;
  /** localised, imperative, e.g. "Send a written objection" */
  text: string;
  primary: boolean;
}

export interface LetterOutput {
  type: OutputType;
  /** true until paid or covered by subscription */
  locked: boolean;
  /** true once generated */
  available: boolean;
  /** first lines, shown while locked */
  previewText: string | null;
  /** full text, only when unlocked */
  bodyText: string | null;
  /** PDF, only when unlocked */
  downloadUrl: string | null;
  /** price to unlock this single output */
  price: Money | null;
}

export interface Letter {
  id: string;
  status: DocumentStatus;
  createdAt: ISODate;
  thumbnailUrl: string | null;
  /** user marked it done -> KLAR stamp */
  handled: boolean;

  // analysis, populated when status === 'ready'
  sender: string | null; // e.g. "Finanzamt Hamburg-Mitte"
  documentType: string | null; // localised, e.g. "Tax assessment"
  referenceNumber: string | null;
  summary: string | null; // the big clarity statement, localised
  whatItWants: string | null; // localised
  consequence: string | null; // localised
  deadline: Deadline | null;
  recommendedActions: ActionItem[];
  output: LetterOutput;
  originalText: string | null; // extracted German source text
  confidence: number | null; // 0..1
}

export interface SubscriptionPlan {
  id: string;
  /** localised, e.g. "Bürokratie-Flat" */
  name: string;
  price: Money;
  interval: 'month' | 'year';
  /** localised */
  features: string[];
}

export interface Me {
  sessionId: string;
  language: Lang;
  subscription: {
    active: boolean;
    planId: string | null;
    renewsAt: ISODate | null;
  };
  lettersCount: number;
}

export interface AppConfig {
  /** price for a single unlock */
  perLetterPrice: Money;
  plans: SubscriptionPlan[];
  supportedLanguages: Lang[];
}

// --- Endpoint payloads ---------------------------------------------------

export interface SessionResponse {
  sessionToken: string;
  me: Me;
}

export interface LettersPage {
  items: Letter[];
  nextCursor: string | null;
}

export interface DeadlineEntry {
  letterId: string;
  sender: string;
  deadline: Deadline;
}

export interface DeadlinesResponse {
  items: DeadlineEntry[];
}

export type PaymentStatus = 'open' | 'paid' | 'failed' | 'canceled' | 'expired';

export type CheckoutTarget =
  | { target: 'document'; documentId: string }
  | { target: 'subscription'; planId: string };

export interface CheckoutResponse {
  paymentId: string;
  checkoutUrl: string;
}

export interface PaymentStatusResponse {
  status: PaymentStatus;
}

// --- Error envelope ------------------------------------------------------

export type ApiErrorCode =
  | 'DOCUMENT_UNREADABLE'
  | 'PAYMENT_REQUIRED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | (string & {});

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    /** human readable, localised */
    message: string;
  };
}
