import type { AIProviderAdapter, ModelInfo, ValidateResult } from '../ai.types';
import { toUserFacingProviderError } from '../ai.security';
import { providerFetch, safeJson } from './http';
import { pickModel } from './openai.provider';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const PREFERRED = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
const FALLBACK = ['gemini-1.5-flash', 'gemini-1.5-pro'];

/**
 * Google Gemini adapter. The key is passed as a query param to Google's
 * endpoints (never logged; requests time out via providerFetch).
 */
export class GeminiAdapter implements AIProviderAdapter {
  readonly id = 'gemini' as const;
  constructor(private readonly apiKey: string, private readonly model?: string) {}

  async validateKey(): Promise<ValidateResult> {
    const res = await providerFetch(
      `${BASE}/models?key=${encodeURIComponent(this.apiKey)}`,
      { method: 'GET' },
    );
    if (!res.ok) throw toUserFacingProviderError(res.status, 'Google Gemini');
    const models = await this.parseModels(res);
    const list = models.length ? models : FALLBACK.map((id) => ({ id }));
    return { valid: true, provider: this.id, models: list, suggestedModel: pickModel(list, PREFERRED) };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await providerFetch(`${BASE}/models?key=${encodeURIComponent(this.apiKey)}`, { method: 'GET' });
      if (!res.ok) return FALLBACK.map((id) => ({ id }));
      const models = await this.parseModels(res);
      return models.length ? models : FALLBACK.map((id) => ({ id }));
    } catch {
      return FALLBACK.map((id) => ({ id }));
    }
  }

  private async parseModels(res: Response): Promise<ModelInfo[]> {
    const body = (await safeJson(res)) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    } | null;
    return (body?.models ?? [])
      .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => ({ id: m.name.replace(/^models\//, '') }))
      .filter((m) => m.id);
  }

  async generateResponse(system: string, user: string): Promise<string> {
    const model = this.model ?? FALLBACK[0];
    const res = await providerFetch(
      `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Gemini v1beta has no dedicated system role; prepend as guidance.
          contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { temperature: 0 },
        }),
      },
    );
    if (!res.ok) throw toUserFacingProviderError(res.status, 'Google Gemini');
    const body = (await safeJson(res)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    } | null;
    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
    if (!text) throw toUserFacingProviderError(502, 'Google Gemini');
    return text;
  }
}
