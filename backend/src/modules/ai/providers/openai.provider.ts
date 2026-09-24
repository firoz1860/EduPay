import type { AIProviderAdapter, AIProviderId, ModelInfo, ValidateResult } from '../ai.types';
import { toUserFacingProviderError } from '../ai.security';
import { providerFetch, safeJson } from './http';

interface OpenAIStyleConfig {
  id: AIProviderId;
  label: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
  preferred: string[];
  fallback: string[];
}

/**
 * Adapter for OpenAI and any OpenAI-compatible API (xAI, custom providers).
 * Uses `/models` for validation/listing and `/chat/completions` for generation.
 */
export class OpenAICompatibleAdapter implements AIProviderAdapter {
  readonly id: AIProviderId;
  private readonly cfg: OpenAIStyleConfig;

  constructor(cfg: OpenAIStyleConfig) {
    this.cfg = cfg;
    this.id = cfg.id;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' };
  }

  async validateKey(): Promise<ValidateResult> {
    const res = await providerFetch(`${this.cfg.baseUrl}/models`, { method: 'GET', headers: this.headers() });
    if (!res.ok) throw toUserFacingProviderError(res.status, this.cfg.label);
    const body = (await safeJson(res)) as { data?: { id: string }[] } | null;
    const ids = (body?.data ?? []).map((m) => m.id).filter(Boolean);
    const models = ids.length ? ids.map((id) => ({ id })) : this.cfg.fallback.map((id) => ({ id }));
    return { valid: true, provider: this.id, models, suggestedModel: pickModel(models, this.cfg.preferred) };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await providerFetch(`${this.cfg.baseUrl}/models`, { method: 'GET', headers: this.headers() });
      if (!res.ok) return this.cfg.fallback.map((id) => ({ id }));
      const body = (await safeJson(res)) as { data?: { id: string }[] } | null;
      const ids = (body?.data ?? []).map((m) => m.id).filter(Boolean);
      return ids.length ? ids.map((id) => ({ id })) : this.cfg.fallback.map((id) => ({ id }));
    } catch {
      return this.cfg.fallback.map((id) => ({ id }));
    }
  }

  async generateResponse(system: string, user: string): Promise<string> {
    const model = this.cfg.model ?? this.cfg.fallback[0];
    const res = await providerFetch(`${this.cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw toUserFacingProviderError(res.status, this.cfg.label);
    const body = (await safeJson(res)) as { choices?: { message?: { content?: string } }[] } | null;
    const content = body?.choices?.[0]?.message?.content?.trim();
    if (!content) throw toUserFacingProviderError(502, this.cfg.label);
    return content;
  }
}

/** Choose the first preferred model present in the list, else the first model. */
export function pickModel(models: ModelInfo[], preferred: string[]): string | null {
  if (models.length === 0) return null;
  for (const p of preferred) {
    const hit = models.find((m) => m.id === p || m.id.startsWith(p));
    if (hit) return hit.id;
  }
  return models[0].id;
}

// Known-good fallback model ids (never invented).
export const OPENAI_PREFERRED = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-3.5-turbo'];
export const OPENAI_FALLBACK = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
export const XAI_PREFERRED = ['grok-2-latest', 'grok-2', 'grok-beta'];
export const XAI_FALLBACK = ['grok-2-latest', 'grok-beta'];
