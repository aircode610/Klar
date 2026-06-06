# Klar Posting Collection

A complete Posting collection covering **every endpoint** of the Klar backend.

## Quick start

```fish
api klar
```

That launches Posting's TUI with `collection/` pre-loaded and `klar.env`
injected. Cookies set by `Login` / `Signup` are reused for subsequent requests
within the same TUI session.

## What's in here

| Path | Purpose |
|---|---|
| `collection/` | 18 `.posting.yaml` files — one per FastAPI endpoint |
| `klar.env` | Environment vars (`BASE_URL`, `EMAIL`, `PASSWORD`, …) |
| `openapi.json` | FastAPI's auto-generated OpenAPI spec, dumped to disk |

## Endpoint inventory

```
Health
  GET    /health

Auth
  POST   /api/auth/signup
  POST   /api/auth/login
  POST   /api/auth/logout
  GET    /api/auth/me
  POST   /api/auth/forgot-password
  POST   /api/auth/reset-password

Letters
  POST   /api/letters/upload          (multipart — attach file in TUI)
  POST   /api/letters/{id}/extract    (synchronous extraction)
  GET    /api/letters/{id}/process    (SSE — full pipeline streamed)
  GET    /api/letters
  GET    /api/letters/{id}

Actions
  GET    /api/actions
  PATCH  /api/actions/{id}

Deadlines
  GET    /api/deadlines

RAG
  POST   /api/rag/search
  POST   /api/rag/reseed
```

## Regenerating the collection

Whenever you add or change a route on the backend, regenerate this collection:

```fish
cd Klar/backend
.venv/bin/python -c "
import json
from app.main import app
with open('../postman/openapi.json','w') as f:
    json.dump(app.openapi(), f, indent=2)
"
cd ../postman
rm -rf collection
posting import openapi.json -o ./collection
```

> `posting import` defaults GET requests to omit the `method:` line. If you
> rely on it being explicit, run this one-liner after import:
>
> ```fish
> for f in (find collection -name '*.posting.yaml'); grep -q '^method:' "$f"; or sed -i '' '2i\\
> method: GET\\
> ' "$f"; end
> ```

## A typical flow inside the TUI

1. **Signup** (or Login) — Posting captures the `klar_session` cookie.
2. **Upload Letter** — multipart; click Body → Form / Multipart, attach a JPEG / PDF.
3. **Process Letter** — SSE stream; uses `{letter_id}` from upload's response.
   Posting renders the `event: …` frames live.
4. **List Letters** / **Get Letter** — confirm the row is `status: completed`.
5. **List Deadlines** — view all extracted obligations sorted by due date.
6. **Update Action** — PATCH `status` to `done` / `ignored`; corrections logged.

## Why this exists

The collection is generated from FastAPI's own OpenAPI spec, so it stays in
lockstep with the implementation. Description text on each request is the
route handler's docstring — the spec is the single source of truth.
