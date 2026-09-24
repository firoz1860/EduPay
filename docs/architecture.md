# EduPay — Architecture

## 1. Overview
EduPay is a modular-monolith backend (Express + Prisma + PostgreSQL) with a Next.js
frontend. The backend is the single source of truth for identity, authorization, and
all financial computation. The frontend is a presentation + interaction layer that
talks only to the backend REST API.

```
┌────────────┐   HTTPS    ┌─────────────────┐   REST /api/v1   ┌──────────────────┐   Prisma   ┌────────────┐
│  Browser   │──────────▶ │ Next.js (Vercel)│────────────────▶ │ Express (Render) │──────────▶ │ PostgreSQL │
└────────────┘            └─────────────────┘                  └──────────────────┘            └────────────┘
                                                                     ▲
                                        Stripe ──webhook (raw body)──┘  signature-verified, idempotent
```

## 2. Why a modular monolith
The brief explicitly warns against unnecessary microservices. A modular monolith gives
clear module boundaries (each `src/modules/<name>` owns its routes/controller/service/
schema) that could later be extracted into services, without the operational cost of
distributed transactions — which matters because financial consistency here relies on
single-database ACID transactions.

## 3. Backend layering
```
routes ─▶ middleware (auth, rbac, validate, idempotency) ─▶ controller (thin)
        ─▶ service (business logic, transactions) ─▶ Prisma ─▶ PostgreSQL
shared: lib/ (money, errors, response, jwt, pagination), services/ (audit, invoice-math,
        payment-state, reconciliation-classifier)
```
- **Controllers are thin** — parse the request, call a service, shape the response.
- **Services own business rules** and open Prisma transactions.
- **Pure domain logic** (money math, status derivation, state machine, reconciliation
  classification) lives in `src/services/*` as side-effect-free functions — which is
  what the unit tests exercise.

## 4. Data model (key tables)
`users, departments, courses, students, fee_heads, fee_structures,
fee_structure_items, invoices, invoice_items, installments, payments,
payment_attempts, gateway_events, idempotency_keys, refunds, ledger_entries,
reconciliation_records, audit_logs`.

- UUID primary keys; `created_at/updated_at` throughout.
- **Money is `Decimal(12,2)`** everywhere — never floats.
- Indexes on hot columns (`studentId`, `invoiceId`, `status`, `providerPaymentId`,
  `gatewayEventId`, `createdAt`, `departmentId`).
- Unique constraints: `payment_number`, `invoice_number`, `refund_number`,
  `gateway_events.gateway_event_id`, `idempotency_keys.key`, `users.email`.

The Prisma schema maps camelCase model fields to the existing snake_case columns via
`@map`/`@@map`, so no destructive migration is needed to reuse the Supabase database.
The login credential is stored in the existing `password` column but exposed as
`passwordHash` (bcrypt).

## 5. Authentication & authorization
- **Login** verifies a bcrypt hash and issues a short-lived JWT **access** token + a
  longer **refresh** token. The frontend stores them and auto-refreshes once on 401.
- **`authenticate`** middleware populates `req.user` from the bearer token.
- **`requireRole(...)`** enforces RBAC per route — the authoritative boundary. The
  frontend's `hasRole` only toggles UI affordances.

## 6. Money & financial consistency
- `lib/money.ts` wraps `Prisma.Decimal` (decimal.js) for exact arithmetic.
- Invoice totals, outstanding amounts and refund eligibility are always recomputed on
  the backend from stored line items — client-supplied totals are ignored.
- **Atomic settlement**: `settlePaymentSuccess` runs inside `prisma.$transaction` and
  updates payment → invoice → installment → ledger → audit together, or rolls back.

## 7. Payment lifecycle & webhooks
```
CREATED ─▶ PENDING ─▶ SUCCESS ─▶ REFUND_PENDING ─▶ REFUNDED
   └▶ FAILED   └▶ CANCELLED
```
- A `Payment` plus `PaymentAttempt` rows are created; `paid: true` is never a sole state.
- With a real Stripe key, a PaymentIntent is created and settlement happens on the
  **webhook** (`POST /api/v1/webhooks/stripe`), which verifies the signature against
  the **raw body** and is **idempotent** via the unique `gateway_events.gateway_event_id`
  (a duplicate delivery is detected and skipped — no double settlement).
- Without a key, a **simulated gateway** endpoint (`/payments/:id/simulate`) drives the
  same atomic settlement path, so the full flow is demonstrable with no secrets.

## 8. Idempotency
Money-moving routes accept an `Idempotency-Key` header. The middleware stores the key +
a hash of the request body; a replay with the same key+payload returns the cached
response, a same-key/different-payload request is rejected 409, and an in-flight key is
409'd. See [`edge-cases.md`](edge-cases.md).

## 9. Reconciliation
`reconciliation-classifier.ts` is a pure function comparing an internal record to the
gateway record and returning one of the 8 statuses. A "run" discovers records for
payments and flags duplicates; finance users resolve discrepancies, and every
resolution writes an audit entry.

## 10. AI
The backend first computes verified aggregates (`ai.context.ts`), then hands them to an
`AIProvider` (mock or OpenAI-compatible) that may only phrase an explanation from those
figures. The AI has no DB access and cannot mutate anything. Runs with no API key.

## 11. Frontend
- `lib/api.ts` is the only network client (base URL from `NEXT_PUBLIC_API_URL`), with
  JWT attach, transparent refresh, and a typed error envelope.
- TanStack Query for caching; React Hook Form + Zod for forms; Recharts for charts;
  shadcn/ui for components. Responsive: sidebar (desktop) / mobile nav.

## 12. Deployment
Feature branch → CI (lint/typecheck/test/build) → preview → PR → review → merge →
production deploy. Backend on Render (`render.yaml`), frontend on Vercel. Production
migrations (if ever needed) run via `prisma migrate deploy`; here the schema already
exists so only `prisma generate` runs at build.
