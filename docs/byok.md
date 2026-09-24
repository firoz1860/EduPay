# EduPay — BYOK AI (Bring Your Own Key)

EduPay's AI features use the **logged-in user's own** AI provider key. No owner/
developer API key is bundled, committed, or required to deploy.

## Security model (the core guarantee)
- The **raw API key lives only in the browser's memory** for the active session
  (`providers/ai-config-provider.tsx`). It is **never** written to the database,
  `localStorage`, `sessionStorage`, logs, analytics, error messages, URLs, or Git.
- The key is sent to the backend **only** via per-request `X-AI-*` headers over
  HTTPS, used transiently to call the provider, and discarded.
- Only **safe, non-secret metadata** (`provider`, `model`, `providerName`) is kept
  in `localStorage` so the modal can prefill and Settings can display it.
- On refresh/restart the key is gone → the setup modal reappears. This is
  deliberate: we never persist users' third-party secrets.
- The logger redacts `x-ai-key` and any `apiKey` field. Provider errors are mapped
  to safe messages that never echo the key or raw provider payloads.

## Providers (adapter architecture)
`backend/src/modules/ai/`
```
ai.types.ts            AIProviderAdapter interface (validateKey/listModels/generateResponse)
provider.factory.ts    the ONLY place provider selection happens
ai.security.ts         key masking, SSRF-safe URL check, provider-error sanitization
ai.credentials.ts      extract X-AI-* creds from a request (never logged)
providers/
  openai.provider.ts       OpenAI + xAI + custom OpenAI-compatible
  anthropic.provider.ts    Claude (/v1/models, /v1/messages)
  gemini.provider.ts       Gemini (models?key=, :generateContent)
  mock.provider.ts         deterministic dev fallback (no key)
ai.service.ts          validate / listModels / ask / insights (verified-data only)
```

## Flow
```
Login → app checks session AI config
  ├─ configured → Dashboard
  └─ not configured (AI-capable role) → AI Setup Modal
        select provider → enter key (password, show/hide) → Validate & Continue
        backend POST /ai/validate → real provider call → models + suggested model
        pick model → Continue → key kept in memory; metadata saved; audit CONNECTED
```
Basic EduPay (students, invoices, payments, reconciliation, reports, audit) works
with **no AI configured** — the modal offers **"Continue without AI"**. Opening an AI
feature without a key shows a "Configure AI" gate.

## Endpoints (`/api/v1/ai`, rate-limited)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/ai/validate` | any user | body `{provider, apiKey, model?, baseUrl?, providerName?}` → `{valid, models, suggestedModel}` (key never returned) |
| POST | `/ai/models` | any user | list models for a key |
| POST | `/ai/connect` | any user | `{provider, model}` → audit `AI_PROVIDER_CONNECTED` (no key) |
| POST | `/ai/disconnect` | any user | audit `AI_PROVIDER_DISCONNECTED` |
| GET | `/ai/insights` | staff+auditor | verified figures + deterministic summaries |
| POST | `/ai/ask` | staff+auditor | `{question}` + `X-AI-*` headers → provider-phrased answer over verified data |
| POST | `/ai/reconciliation-summary` | staff+auditor | reconciliation narrative |

## Custom (OpenAI-compatible) providers
User supplies base URL + key + model. In production the URL must be HTTPS and
public — localhost/private/link-local/metadata hosts are rejected (SSRF guard,
`assertSafeAiUrl`).

## Financial safety
AI has **no write path**. All figures come from deterministic backend queries
(`ai.context.ts`); the provider only phrases an explanation and is instructed to
never invent numbers. AI can never modify payments, invoices, refunds, the ledger,
reconciliation, or fees.

## Errors & resilience
Provider `401/403/404/429/400/5xx`/timeout map to friendly messages
(`toUserFacingProviderError`); every provider call has a 20s timeout. If AI is
unavailable, payments/reconciliation/reports/dashboard keep working — only AI
features degrade.

## Tests
`backend/tests/ai-security.test.ts`, `ai-provider.test.ts` (mocked `fetch`, no real
keys): key masking, SSRF rejection, error sanitization (no key leakage), model
auto-detect, provider 401/429 mapping, factory selection, header credential parsing.
