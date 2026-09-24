# EduPay — Edge Cases & Handling

Each of the 20 required edge cases and exactly how EduPay handles it.

| # | Edge case | Handling |
|---|---|---|
| 1 | User closes browser during payment | Payment is a server-side record (CREATED/PENDING). Settlement happens on the webhook/simulate call independent of the browser, so closing it never loses money state. |
| 2 | Payment gateway timeout | Payment stays PENDING; no invoice/ledger mutation occurs until a SUCCESS event arrives. Reconciliation later flags a lingering PENDING as STATE_MISMATCH if the gateway shows success. |
| 3 | Payment succeeds but frontend never gets the response | The webhook settles the payment authoritatively; the UI reflects it on next fetch. The response is not the source of truth. |
| 4 | Duplicate webhook | `gateway_events.gateway_event_id` is UNIQUE. A second delivery is detected (or collides on insert) and skipped — settlement never runs twice. A `WEBHOOK_DUPLICATE` audit row is written. |
| 5 | Webhook arrives before the frontend response | Irrelevant — settlement is webhook-driven and idempotent; ordering doesn't matter. |
| 6 | Long-running pending payment | Remains PENDING; reconciliation surfaces it. It can be cancelled (`/payments/:id/cancel`) per the state machine. |
| 7 | Full refund | Allowed when `amount == remaining refundable`; on completion the payment transitions to REFUNDED and a compensating DEBIT ledger entry is written. |
| 8 | Partial refund | Allowed when `amount < remaining`; payment stays REFUND_PENDING; invoice paid/outstanding recomputed. |
| 9 | Duplicate payment | Idempotency-Key returns the prior result for an identical retry. Genuinely distinct duplicate settlements against one gateway id are flagged DUPLICATE in reconciliation. |
| 10 | Amount mismatch | Reconciliation classifier returns AMOUNT_MISMATCH when internal ≠ gateway amount (takes precedence over state mismatch). |
| 11 | Invalid webhook signature | `stripe.webhooks.constructEvent` throws → 400 `WEBHOOK_SIGNATURE_INVALID`; nothing is processed. |
| 12 | Discount modification | Fee-structure changes are audited (`FEE_UPDATED`); invoice totals are computed from line items at creation and never trust client input. |
| 13 | Partial installment payment | A payment against an installment updates its `paidAmount`/`outstandingAmount` and derives PENDING/PARTIALLY_PAID/PAID. |
| 14 | Overpayment | Rejected by default (422) unless `allowOverpayment: true`; `computeOutstanding` clamps negative outstanding to 0. |
| 15 | Multiple outstanding invoices | Each invoice is independent; payments target a specific invoice/installment. |
| 16 | Cancelled invoice | Payments against a CANCELLED invoice are rejected (422); cancelling an invoice with payments is blocked (refund instead). |
| 17 | Old-payment refund | Refund references the payment id regardless of age; eligibility is based on the refundable balance, not time. |
| 18 | Missing gateway record | Reconciliation MISSING_GATEWAY: internal SUCCESS with no gateway record (seeded example included). |
| 19 | Missing internal record | Reconciliation MISSING_INTERNAL: gateway reports a transaction with no internal payment. |
| 20 | State mismatch | Reconciliation STATE_MISMATCH: internal PENDING vs gateway SUCCESS (the classic lost-callback case; seeded example included). |

## Idempotency semantics (summary)
- Same key + same payload, completed → replay stored response (`idempotent-replay: true`).
- Same key + same payload, still processing → 409 (in-flight).
- Same key + different payload → 409 `IDEMPOTENCY_KEY_CONFLICT`.
- New key → process, then persist the response for future replays.

## Transaction boundaries
Payment settlement, refund completion, invoice creation, reconciliation resolution and
audit writes all execute inside `prisma.$transaction` so related rows commit or roll
back together — no half-applied money state.
