# EduPay — Fee Collection & Reconciliation Platform

A production-oriented full-stack platform for educational institutions to manage fee
structures, issue invoices, collect payments, and — the differentiating feature —
**reconcile internal payment records against the payment gateway** with an auditable,
financially-consistent backend.

> Monorepo: **`frontend/`** (Next.js 13 App Router, deploys to Vercel) +
> **`backend/`** (Express + Prisma modular monolith, deploys to Render) over a
> **PostgreSQL** database (reuses your Supabase Postgres).

---

## Problem statement
Institutions collect fees across many heads (tuition, hostel, transport…) with
discounts, scholarships and installments. Payments flow through a gateway that can
fail, time out, double-fire webhooks, or disagree with internal records. EduPay makes
the money **provably correct**: totals are computed server-side, state changes are
atomic, webhooks are idempotent, and every discrepancy is surfaced and resolved with a
full audit trail.

## Feature highlights
- **RBAC** — STUDENT, ACCOUNTANT, FINANCE_MANAGER, ADMIN, AUDITOR, enforced **server-side** on every route.
- **Fee management** — fee heads, structures (with discounts/scholarships), backend-computed totals.
- **Invoices** — DRAFT→ISSUED→PARTIALLY_PAID→PAID→OVERDUE/CANCELLED, with optional installment plans.
- **Payments** — Stripe test-mode + a simulated gateway fallback; full lifecycle with `Payment` + `PaymentAttempt` records.
- **Idempotency** — `Idempotency-Key` on money-moving routes; Stripe webhooks de-duplicated via unique gateway event ids.
- **Financial consistency** — payment → invoice → installment → ledger → audit in one DB transaction.
- **Immutable ledger** — append-only; refunds create compensating entries.
- **Reconciliation** — deterministic classifier: MATCHED, AMOUNT_MISMATCH, STATE_MISMATCH, MISSING_INTERNAL, MISSING_GATEWAY, DUPLICATE, PENDING_REVIEW, RESOLVED — with staff resolution + audit.
- **Refunds** — full/partial, over-refund prevention, approval workflow.
- **Reports** — server-side aggregation (no dumping rows to the client).
- **AI assistant (BYOK)** — Bring Your Own Key: each user connects their own OpenAI / Anthropic / Gemini / xAI / OpenAI-compatible key at runtime. Keys are **session-memory-only** (never stored in the DB, localStorage, logs, or Git); the backend validates the key with a real provider call, auto-detects a model, and acts as a gateway. AI explains verified figures only — never invents numbers, never mutates records. No owner API key required to deploy.
- **Security** — bcrypt, JWT (access+refresh), Zod validation, Helmet, CORS allow-list, rate limiting, no secrets in Git.

## Tech stack
**Frontend:** Next.js 13 (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query, React Hook Form, Zod, Recharts, Lucide.
**Backend:** Node, Express, TypeScript, Prisma, PostgreSQL, Zod, JWT, bcrypt, Stripe.
**Infra:** Docker (multi-stage, non-root), docker-compose, Render (`render.yaml`), Vercel (`vercel.json`).

## Repository layout
```
edupay/
├── frontend/   Next.js app  (lib/api.ts is the single API client)
├── backend/    Express + Prisma modular monolith (src/modules/*)
├── docs/       architecture, api, assumptions, edge-cases, ai-usage-report
├── supabase/   original SQL migrations (schema reference)
├── docker-compose.yml
└── README.md
```

## Architecture at a glance
```
Browser ──HTTPS──▶ Next.js (Vercel) ──REST /api/v1──▶ Express (Render) ──Prisma──▶ PostgreSQL
                                                          │
                                          Stripe webhook ─┘ (raw body, signature-verified, idempotent)
```
The frontend **never** talks to the database directly and **never** holds a DB
credential; only `NEXT_PUBLIC_*` values reach the browser. All authorization and all
money math live in the backend. See [`docs/architecture.md`](docs/architecture.md).

## Local setup

### 1. Backend
```bash
cd backend
cp .env.example .env         # set DATABASE_URL (your Supabase Postgres) + secrets
npm install
npm run prisma:generate
npm run seed                 # demo data (resets demo tables)
npm run dev                  # http://localhost:8080  (GET /health -> {"status":"ok"})
```
Tables already exist in Supabase, so **no migration is required** — just
`prisma:generate`. Reconcile drift with `npm run prisma:pull`.

### 2. Frontend
```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
npm install
npm run dev                  # http://localhost:3000
```

### Or with Docker (Postgres + backend)
```bash
docker compose up --build
```

## Environment variables
| Frontend | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL incl. `/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | App display name |

| Backend | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Supabase pooled for prod) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Token signing |
| `FRONTEND_URL` | Comma-separated CORS allow-list |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional; falls back to simulated gateway |
| `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL` | `mock` default; works with no key |

Full lists in `frontend/.env.example` and `backend/.env.example`.

## Demo credentials
Password for all accounts: **`demo1234`**

| Email | Role |
|---|---|
| admin@edupay.edu | ADMIN |
| finance@edupay.edu | FINANCE_MANAGER |
| accountant@edupay.edu | ACCOUNTANT |
| auditor@edupay.edu | AUDITOR |
| student1@edupay.edu | STUDENT |

## Demo flow (interview)
Login as Admin → Dashboard → open a Student → view Fee Structure → open an Invoice →
Make a test payment → watch Payment status + Invoice update → see the Ledger entry →
see the Audit log → open Reconciliation → show a MATCHED and an AMOUNT_MISMATCH →
Resolve an issue → see the audit trail → open AI Insights → ask an analytical
question → read the AI explanation built from verified backend data.

## Testing
```bash
cd backend && npm test        # Vitest: fee calc, invoice status, payment state
                              # machine, reconciliation classifier, money (29 tests)
```

## Deployment
- **Backend → Render**: `backend/render.yaml` blueprint (`rootDir: backend`), build
  `npm install && npm run build`, start `npm run start`, health `/health`, binds `0.0.0.0`.
- **Frontend → Vercel**: import `frontend/`, set `NEXT_PUBLIC_API_URL` to the Render URL.
- Set `FRONTEND_URL` on the backend to the Vercel origin for CORS.
See [`docs/architecture.md`](docs/architecture.md) for the full production workflow.

## Documentation
- [`docs/architecture.md`](docs/architecture.md) — system design, data model, flows
- [`docs/api.md`](docs/api.md) — REST endpoint reference
- [`docs/assumptions.md`](docs/assumptions.md) — scoping decisions & trade-offs
- [`docs/edge-cases.md`](docs/edge-cases.md) — the 20 required edge cases and how each is handled
- [`docs/ai-usage-report.md`](docs/ai-usage-report.md) — honest AI-usage report

## Trade-offs & future work
See `docs/assumptions.md`. In brief: single Postgres (no Redis/Kafka — YAGNI for this
scope); simulated gateway path so the product runs without Stripe keys; installment
refunds tracked at invoice level; AI provider abstraction ready for a real key.
