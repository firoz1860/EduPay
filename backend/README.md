# EduPay — Backend API

Express + TypeScript + Prisma (PostgreSQL) modular-monolith backend for the EduPay
Fee Collection & Reconciliation Platform.

## Stack
- Node.js + Express + TypeScript
- Prisma ORM → PostgreSQL (reuses your Supabase Postgres)
- Zod validation, JWT auth (access + refresh), bcrypt password hashing
- Stripe (test mode) payments + signed, idempotent webhooks
- Pino structured logging, Helmet, CORS allow-list, rate limiting
- Vitest unit tests

## Architecture
Modular monolith. Each feature is a module under `src/modules/<name>/` with
`*.schema.ts` (Zod) → `*.service.ts` (business logic) → `*.controller.ts` (thin) →
`*.routes.ts`. Cross-cutting concerns live in `src/middleware`, reusable helpers in
`src/lib`, shared domain logic in `src/services`.

Key financial guarantees:
- **Money never uses floats** — all amounts are `Decimal(12,2)` (`src/lib/money.ts`).
- **Backend-authoritative totals** — invoice/payable/outstanding/refund-eligibility
  are computed server-side; client-supplied totals are ignored.
- **Atomic settlement** — payment → invoice → installment → ledger → audit all run
  inside one Prisma `$transaction` (`src/modules/payments/payments.settlement.ts`).
- **Idempotency** — `Idempotency-Key` header on money-moving routes
  (`src/middleware/idempotency.middleware.ts`); Stripe webhooks are de-duplicated via
  the unique `gateway_events.gateway_event_id`.
- **Immutable ledger & audit** — append-only; corrections are compensating entries.
- **Server-side RBAC** — `requireRole(...)` guards every protected route.

## Setup
```bash
cp .env.example .env          # then fill DATABASE_URL + secrets
npm install
npm run prisma:generate       # generate the Prisma client
npm run seed                  # load demo data (resets demo tables)
npm run dev                   # http://localhost:8080
```

Because the tables already exist in your Supabase DB, no migration is required —
just `prisma:generate`. If your live schema drifts, run `npm run prisma:pull`.

## Scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | Watch-mode dev server (tsx) |
| `npm run build` | `prisma generate` + `tsc` → `dist/` |
| `npm start` | Run compiled server (`dist/server.js`) |
| `npm run seed` | Seed demo data |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |

## Environment variables
See `.env.example`. Required: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
Optional: `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (falls back to a simulated
gateway when absent), `AI_PROVIDER` (`mock` default, or `openai` + `OPENAI_API_KEY`).

## API
Base path: `/api/v1`. Health: `GET /health` (no auth) → `{ "status": "ok" }`.

`auth`, `users`, `students`, `departments`, `fee-heads`, `fee-structures`,
`invoices`, `installments`, `payments`, `refunds`, `reconciliation`, `ledger`,
`audit-logs`, `reports`, `ai`.

Response envelope:
```json
{ "success": true, "data": {}, "message": "..." }
{ "success": false, "error": { "code": "...", "message": "...", "details": [] }, "requestId": "..." }
```

Stripe webhook: `POST /api/v1/payments/webhook` (raw body, signature-verified).

## Deploy (Render)
`render.yaml` is a ready Blueprint (`rootDir: backend`). Set `DATABASE_URL`
(Supabase **pooled** connection string), `FRONTEND_URL` (your Vercel origin), and
Stripe secrets in the dashboard. Build `npm install && npm run build`, start
`npm run start`, health check `/health`. Server binds `0.0.0.0`.

## Docker
`docker compose up` (from repo root) runs Postgres + this API. The image is a
multi-stage, non-root build with a container healthcheck.
