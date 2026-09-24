import type { AIProviderAdapter, ModelInfo, ValidateResult } from '../ai.types';
import { toUserFacingProviderError } from '../ai.security';
import { providerFetch, safeJson } from './http';
import { pickModel } from './openai.provider';

const BASE = 'https://api.anthropic.com';
const VERSION = '2023-06-01';
const PREFERRED = ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-haiku-20240307'];
const FALLBACK = ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'];

/** Anthropic (Claude) adapter — /v1/models to validate, /v1/messages to generate. */
export class AnthropicAdapter implements AIProviderAdapter {
  readonly id = 'anthropic' as const;
  constructor(private readonly apiKey: string, private readonly model?: string) {}

  private headers(): Record<string, string> {
    return { 'x-api-key': this.apiKey, 'anthropic-version': VERSION, 'Content-Type': 'application/json' };
  }

  async validateKey(): Promise<ValidateResult> {
    const res = await providerFetch(`${BASE}/v1/models`, { method: 'GET', headers: this.headers() });
    if (!res.ok) throw toUserFacingProviderError(res.status, 'Anthropic');
    const body = (await safeJson(res)) as { data?: { id: string }[] } | null;
    const ids = (body?.data ?? []).map((m) => m.id).filter(Boolean);
    const models = ids.length ? ids.map((id) => ({ id })) : FALLBACK.map((id) => ({ id }));
    return { valid: true, provider: this.id, models, suggestedModel: pickModel(models, PREFERRED) };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await providerFetch(`${BASE}/v1/models`, { method: 'GET', headers: this.headers() });
      if (!res.ok) return FALLBACK.map((id) => ({ id }));
      const body = (await safeJson(res)) as { data?: { id: string }[] } | null;
      const ids = (body?.data ?? []).map((m) => m.id).filter(Boolean);
      return ids.length ? ids.map((id) => ({ id })) : FALLBACK.map((id) => ({ id }));
    } catch {
      return FALLBACK.map((id) => ({ id }));
    }
  }

  async generateResponse(system: string, user: string): Promise<string> {
    const model = this.model ?? FALLBACK[0];
    const res = await providerFetch(`${BASE}/v1/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw toUserFacingProviderError(res.status, 'Anthropic');
    const body = (await safeJson(res)) as { content?: { text?: string }[] } | null;
    const text = body?.content?.map((c) => c.text ?? '').join('').trim();
    if (!text) throw toUserFacingProviderError(502, 'Anthropic');
    return text;
  }
}
