import type { Request } from 'express';
import { z } from 'zod';
import type { AICredentials } from './ai.types';

export const providerEnum = z.enum(['openai', 'anthropic', 'gemini', 'xai', 'openai-compatible']);

/** Body schema for the setup endpoints (/validate, /models). Key is in the body over HTTPS. */
export const credentialsBodySchema = z.object({
  provider: providerEnum,
  apiKey: z.string().min(1, 'API key is required').transform((s) => s.trim()),
  model: z.string().trim().min(1).max(120).optional(),
  baseUrl: z.string().trim().url().optional(),
  providerName: z.string().trim().max(80).optional(),
});

/**
 * Extract BYOK credentials from request headers (used by /ask, /insights).
 * The key is read from `X-AI-Key` and never persisted or logged.
 * Returns null when no key header is present.
 */
export function credentialsFromHeaders(req: Request): AICredentials | null {
  const apiKey = req.header('x-ai-key')?.trim();
  const provider = req.header('x-ai-provider')?.trim();
  if (!apiKey || !provider) return null;

  const parsed = providerEnum.safeParse(provider);
  if (!parsed.success) return null;

  return {
    provider: parsed.data,
    apiKey,
    model: req.header('x-ai-model')?.trim() || undefined,
    baseUrl: req.header('x-ai-base-url')?.trim() || undefined,
    providerName: req.header('x-ai-provider-name')?.trim() || undefined,
  };
}
