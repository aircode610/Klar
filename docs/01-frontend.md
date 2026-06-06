# Klar — Frontend Spec

**Owner: Dev 1 (Frontend)**
**Stack: Next.js + TypeScript + React + next-pwa**
**Deploy: Vercel (free tier)**

---

## Pages / Routes

| Route | Purpose | Priority |
|-------|---------|----------|
| `/` | Landing page — hero with upload CTA, value proposition | Hour 0-1 |
| `/login` | Email/password login form | Hour 0-1 |
| `/signup` | Registration form | Hour 0-1 |
| `/upload` | Upload letter (drag-drop, file picker, camera) | Hour 1-2 |
| `/results/[id]` | Live streaming results page | Hour 2-3 |
| `/dashboard` | List of all processed letters + deadlines | Hour 3-4 |

---

## Components

### UploadZone

The primary input component. Must support three input methods:

- **Drag-and-drop** — Drop area with visual feedback (dashed border, icon change on hover)
- **File picker** — Standard `<input type="file">` accepting `.jpg`, `.png`, `.pdf`
- **Camera capture** — Button that triggers `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`. Captures a photo, converts to blob, sends to API.

On file selected/captured:
1. Show preview thumbnail
2. POST to `/api/letters/upload` with multipart form data
3. On success, redirect to `/results/[letter_id]`

### StreamingResults

Connects to the backend SSE endpoint and renders sections progressively.

**SSE connection:**
```typescript
// EventSource does NOT support custom headers — pass JWT and language as query params
const token = localStorage.getItem('token');
const lang = localStorage.getItem('language') || 'en';
const eventSource = new EventSource(
  `${API_BASE}/api/letters/${id}/process?token=${token}&lang=${lang}`
);

eventSource.addEventListener('ocr_result', (e) => { /* update OCR section */ });
eventSource.addEventListener('classification', (e) => { /* update type badge */ });
eventSource.addEventListener('risk_score', (e) => { /* update risk indicator */ });
eventSource.addEventListener('deadline', (e) => { /* update deadline section */ });
eventSource.addEventListener('consequence', (e) => { /* update consequence section */ });
eventSource.addEventListener('explanation', (e) => { /* append to explanation, token by token */ });
eventSource.addEventListener('response_draft', (e) => { /* append to response section */ });
eventSource.addEventListener('checklist', (e) => { /* render checklist items */ });
eventSource.addEventListener('citations', (e) => { /* render § references */ });
eventSource.addEventListener('done', (e) => { /* close connection, save results */ });
eventSource.addEventListener('error', (e) => { /* show error state */ });
```

**UI sections (rendered in order as events arrive):**

1. **OCR Text** — Collapsible section showing raw extracted text. Starts with a loading spinner, replaced by text when `ocr_result` arrives.
2. **Letter Type Badge** — Pill/badge showing classification (e.g., "Residence Permit - Document Request"). Appears on `classification` event.
3. **Risk Score** — Visual indicator (1-5). Color coded: 1-2 green, 3 yellow, 4-5 red. Appears on `risk_score` event.
4. **Deadline** — Date + countdown timer ("14 days remaining"). Highlighted if urgent (<7 days). Appears on `deadline` event.
5. **Consequence** — What happens if the deadline is missed. Red-tinted card. Appears on `consequence` event.
6. **Explanation** — Markdown-rendered explanation in user's language. Streams token by token (like ChatGPT). Use a markdown renderer (e.g., `react-markdown`).
7. **Response Draft** — The generated reply in Behördendeutsch. Rendered in a card with:
   - "Copy to clipboard" button
   - "Download as PDF" button (use browser print or `html2pdf.js`)
8. **Document Checklist** — List of required documents with checkboxes. User can check off items they've prepared.
9. **§ Citations** — Collapsible section listing legal references (e.g., "§ 81 Abs. 4 AufenthG — Antrag auf Aufenthaltstitel").

### DeadlineDashboard

- Table or card grid showing all user's letters
- Columns: letter type, deadline date, days remaining, risk score, status
- Sorted by urgency (nearest deadline first)
- Color-coded rows: overdue (red), urgent <7 days (orange), normal (default)
- Click a row → navigate to `/results/[id]`

### LanguageSelector

- Dropdown in the header/nav
- Options: English, German, Turkish, Arabic, Spanish, French, Chinese (most common internationals in Germany)
- Stored in user profile (API call to update) and in localStorage for quick access
- Passed to backend with each processing request

### AuthForms

- Login: email + password fields + submit
- Signup: email + password + confirm password + submit
- Form validation (email format, password minimum length)
- Error display for invalid credentials
- Redirect to `/dashboard` on success
- Store JWT in localStorage / httpOnly cookie

---

## PWA Configuration

Using `next-pwa`:

```typescript
// next.config.ts
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
});
```

**Manifest (`public/manifest.json`):**
- `name`: "Klar"
- `short_name`: "Klar"
- `description`: "German bureaucracy, finally klar."
- `theme_color`: "#1e3a5f" (deep blue)
- `background_color`: "#ffffff"
- `display`: "standalone"
- `icons`: 192x192 and 512x512 PNG

**Offline page:** Simple branded page saying "You're offline. Klar needs an internet connection to process letters."

---

## Styling Guidelines

- **Color palette:**
  - Primary: `#1e3a5f` (deep blue — trust, authority)
  - Accent: `#e67e22` (orange — urgency, deadlines)
  - Success: `#27ae60`
  - Danger: `#e74c3c`
  - Background: `#f8f9fa`
  - Text: `#2c3e50`
- **Typography:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`)
- **Layout:** Mobile-first, max-width container (720px for results, 1080px for dashboard)
- **Components:** Clean, minimal. Rounded corners (8px). Subtle shadows for cards.
- No CSS framework — use CSS modules or Tailwind (dev's preference)

---

## Integration Points

| What | Where | Format |
|------|-------|--------|
| File upload | `POST ${API_BASE}/api/letters/upload` | Multipart form data |
| SSE stream | `GET ${API_BASE}/api/letters/{id}/process` | Server-Sent Events |
| Auth | `POST ${API_BASE}/api/auth/login` and `/signup` | JSON, returns JWT |
| Letters list | `GET ${API_BASE}/api/letters` | JSON array |
| Deadlines | `GET ${API_BASE}/api/deadlines` | JSON array |
| Language update | Sent as query param with SSE request | `?lang=en` (query param, NOT header) |

**API base URL:** Environment variable `NEXT_PUBLIC_API_URL` (set in Vercel dashboard).

**CORS:** Backend must allow the Vercel domain. Dev 2 handles this.

---

## Hour-by-Hour Plan

| Hour | Deliverable |
|------|------------|
| 0-1 | Next.js project init, PWA config, layout shell, landing page, auth pages |
| 1-2 | Upload page with drag-drop + file picker + camera capture |
| 2-3 | Results page with SSE client, streaming UI sections |
| 3-4 | Dashboard page, language selector, deadline display |
| 4-5 | UI polish, responsive design, loading states, error states |
| 5-6 | Deploy to Vercel, end-to-end testing with backend, final fixes |
