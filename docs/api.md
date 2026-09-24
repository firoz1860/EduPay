# EduPay — API Reference

Base URL: `/api/v1`. All responses use a consistent envelope.

**Success**
```json
{ "success": true, "data": {}, "message": "..." }
```
Paginated list endpoints add `"meta": { "page", "pageSize", "total", "totalPages" }`.

**Error**
```json
{ "success": false, "error": { "code": "...", "message": "...", "details": [] }, "requestId": "..." }
```

Auth: send `Authorization: Bearer <accessToken>`. Money-moving POSTs accept an
`Idempotency-Key` header. Common status codes: 200/201, 400, 401, 403, 404, 409
(conflict / idempotency), 422 (validation/business rule), 429 (rate limit), 500.

## Health
- `GET /health` → `{ "status": "ok" }` (no auth)

## Auth — `/auth`
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/login` | `{email, password}` | → `{user, accessToken, refreshToken}` |
| POST | `/auth/refresh` | `{refreshToken}` | → new tokens |
| GET | `/auth/me` | — | current user |

## Users — `/users` (ADMIN)
`GET /` · `GET /:id` · `POST /` `{email,password,fullName,role,isActive}` · `PATCH /:id`. Never returns `passwordHash`.

## Students — `/students`
`GET /?page&pageSize&search&status&departmentId&courseId` · `GET /:id` (with department, course, invoiceSummary) ·
`POST /` (ADMIN, ACCOUNTANT) · `PATCH /:id` (ADMIN, ACCOUNTANT). Students see only themselves.

## Departments — `/departments`
`GET /` · `GET /:id` (with courses) · `POST /` (ADMIN) · `PATCH /:id` (ADMIN) · `GET /:id/courses` · `POST /:id/courses` (ADMIN).

## Fee heads — `/fee-heads`
`GET /` · `GET /:id` · `POST /` · `PATCH /:id` (write: ADMIN, ACCOUNTANT).

## Fee structures — `/fee-structures`
`GET /?academicYear&departmentId&courseId&status` (with items+feeHead) · `GET /:id` ·
`POST /` `{name, departmentId?, courseId?, academicYear, semester, items:[{feeHeadId, amount, discountAmount?, discountLabel?}]}` (ADMIN, ACCOUNTANT) — `totalAmount` computed server-side · `PATCH /:id`.

## Invoices — `/invoices`
| Method | Path | Notes |
|---|---|---|
| GET | `/?page&pageSize&search&status&studentId` | list |
| GET | `/:id` | with items, installments, payments, student |
| POST | `/` | `{studentId, feeStructureId? \| items[], taxAmount?, dueDate?, installmentCount?, issue?}` (ADMIN/ACCOUNTANT/FINANCE_MANAGER) |
| POST | `/:id/issue` | DRAFT → ISSUED |
| POST | `/:id/cancel` | `{reason?}` — blocked if payments exist |

## Installments — `/installments`
`GET /?invoiceId&status` · `GET /:id` (read-only; created with invoices).

## Payments — `/payments`
| Method | Path | Notes |
|---|---|---|
| GET | `/?page&pageSize&search&status&invoiceId&studentId` | list |
| GET | `/:id` | with attempts |
| POST | `/` | `{invoiceId, installmentId?, amount, method?, allowOverpayment?}` — **Idempotency-Key**; → `{payment, simulated, clientSecret, provider}` |
| POST | `/:id/simulate` | `{outcome:'success'\|'fail', failureReason?}` — settles when no real Stripe (**Idempotency-Key**) |
| POST | `/:id/cancel` | cancel a CREATED/PENDING payment |
| POST | `/api/v1/webhooks/stripe` | Stripe webhook — **raw body**, signature-verified, idempotent (no auth). Legacy alias: `/api/v1/payments/webhook` |

## Refunds — `/refunds`
| Method | Path | Notes |
|---|---|---|
| GET | `/?status&paymentId&studentId` | list |
| GET | `/:id` | one |
| POST | `/` | `{paymentId, amount, reason}` — over-refund blocked; **Idempotency-Key** (ACCOUNTANT/FINANCE_MANAGER/ADMIN) |
| POST | `/:id/approve` | `{notes?}` (FINANCE_MANAGER/ADMIN) |
| POST | `/:id/complete` | atomic money movement + ledger (**Idempotency-Key**, FINANCE_MANAGER/ADMIN) |

## Reconciliation — `/reconciliation`
`GET /?page&pageSize&status&search` → `{data, meta, summary}` · `GET /:id` ·
`POST /run` (ACCOUNTANT/FINANCE_MANAGER/ADMIN) → `{created, summary}` ·
`POST /:id/resolve` `{resolutionNotes}` (FINANCE_MANAGER/ADMIN). Read: staff + AUDITOR.

## Ledger — `/ledger`
`GET /?type&direction&studentId&invoiceId&paymentId` · `GET /:id` (read-only, immutable).

## Audit logs — `/audit-logs` (ADMIN, AUDITOR, FINANCE_MANAGER)
`GET /?entity&action&actorId&entityId&search` · `GET /:id`.

## Reports — `/reports` (staff + AUDITOR)
`GET /dashboard` · `GET /collection-by-department` · `GET /collection-by-fee-head` ·
`GET /payment-status` · `GET /outstanding`. Server-side aggregation.

## AI — `/ai` (staff + AUDITOR)
`GET /insights` → `{provider, verifiedData, collectionHealth, reconciliationSummary}` ·
`POST /ask` `{question}` → `{answer, provider, verifiedData}`. Uses verified data only.
