/**
 * @deprecated The owner-key AI provider has been removed in favor of BYOK
 * (Bring Your Own Key). EduPay no longer reads a personal OPENAI_API_KEY to call
 * a provider on the user's behalf.
 *
 * Use instead:
 *  - `provider.factory.ts`  → build a per-request adapter from the user's key
 *  - `providers/*.ts`       → OpenAI / Anthropic / Gemini / xAI / compatible / mock
 *  - `ai.service.ts`        → validate / listModels / ask / insights
 *
 * This file is intentionally empty of provider logic so no owner credential path
 * remains.
 */
export {};
