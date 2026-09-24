# EduPay — Assumptions & Trade-offs

## Scoping decisions
1. **Reuse the existing Supabase Postgres.** Prisma introspects/maps the existing
   schema (snake_case columns → camelCase models) so no destructive migration is
   needed. The backend connects via `DATABASE_URL` (direct/pooled Postgres), which
   bypasses the permissive demo RLS policies. The frontend no longer uses the Supabase
   anon key at all, closing that public-exposure hole.
2. **Login credential column.** The original `users.password` column is reused to store
   the **bcrypt hash** (mapped as `passwordHash`), avoiding a schema change. The seed
   overwrites the old plaintext values with hashes.
3. **Simulated gateway.** Stripe test-mode is fully wired (PaymentIntent + signed
   webhook), but because a Stripe key may not be present in every environment, a
   deterministic **simulated** settlement endpoint drives the same atomic path so the
   product is demonstrable without secrets. Set `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
   to use the real flow.
4. **AI runs without a key.** `AI_PROVIDER=mock` (default) returns deterministic answers
   built from verified figures; `openai` uses an OpenAI-compatible endpoint. Either way,
   the AI only explains verified data and never mutates records.
5. **No Redis/Kafka.** The brief calls for simple infra; caching is handled by TanStack
   Query (client) and short-lived server aggregation. Idempotency and reconciliation use
   the database, not a broker. YAGNI.

## Financial assumptions
- Currency is INR; amounts are `Decimal(12,2)`.
- **Backend is authoritative** for invoice totals, paid/outstanding amounts, payment
  status, refund eligibility and reconciliation results. Client-supplied totals are
  never trusted.
- Overpayment is rejected by default; callers may pass `allowOverpayment: true` to
  intentionally allow it.
- Refund eligibility is computed against the sum of the payment's non-cancelled refunds
  (PENDING+APPROVED+COMPLETED reserve the amount) to prevent over-refunding.
- Refunds adjust the **invoice** paid/outstanding and write a compensating DEBIT ledger
  entry. Installment-level refund allocation is not modeled (invoice-level only).
- Reconciliation "run" creates records for payments lacking one and flags duplicate
  gateway references; it does not overwrite existing (seeded or resolved) records, so a
  re-run never masks a discrepancy.

## Auth assumptions
- JWT access token (15m) + refresh token (7d), both signed (stateless refresh — no
  server-side token store, to avoid an extra schema change). Logout is client-side token
  disposal; there is no server revocation list (acceptable for this scope).

## Security assumptions
- The demo RLS policies in the original Supabase migrations are permissive
  (`anon` full access). Because the app now goes through the backend, these should be
  **locked down or disabled** in the Supabase dashboard for a real deployment. The
  backend's own RBAC is the enforced boundary.

## Known limitations / future work
- Server-side reconciliation is discovery + classification; a scheduled job and a
  real gateway settlement-file importer would extend it.
- No email/SMS notifications; no PDF invoice export.
- Token revocation, refresh-token rotation, and 2FA are future hardening.
- Installment-level refund allocation and partial-installment scheduling could be added.
- CI (GitHub Actions) is described in the architecture; wiring the workflow file is the
  next step once the GitHub remote exists.
