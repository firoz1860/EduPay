import { env } from '../../config/env';
import { logger } from '../../lib/logger';

/**
 * AI provider abstraction. Providers are READ-ONLY explainers: they receive a
 * system prompt + a user message that already contains verified, backend-computed
 * figures, and they return natural-language text. They have NO database access and
 * cannot modify any financial record.
 */
export interface AIProvider {
  readonly name: string;
  complete(system: string, user: string): Promise<string>;
}

/**
 * Deterministic offline provider. Requires no API key so the app always runs.
 * It never invents numbers — it only surfaces the verified figures it is given
 * (the caller composes the `user` payload from real backend data and also passes
 * a pre-rendered fallback answer for it to return).
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock';
  private readonly fallback: () => string;

  constructor(fallback: () => string) {
    this.fallback = fallback;
  }

  async complete(_system: string, _user: string): Promise<string> {
    return this.fallback();
  }
}

/** OpenAI-compatible chat completions provider (works with any compatible base URL). */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  async complete(system: string, user: string): Promise<string> {
    const res = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0, // deterministic; do not embellish
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error({ status: res.status, text }, 'OpenAI request failed');
      throw new Error(`AI provider error (${res.status})`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('AI provider returned empty response');
    return content;
  }
}

/**
 * Selects a provider. Falls back to the mock provider whenever OpenAI is not
 * fully configured, so the product is always demonstrable.
 */
export function selectProvider(fallback: () => string): AIProvider {
  if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    return new OpenAIProvider();
  }
  return new MockProvider(fallback);
}
