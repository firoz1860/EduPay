import type { AICredentials, AIProviderAdapter } from './ai.types';
import { assertSafeAiUrl } from './ai.security';
import { BadRequestError } from '../../lib/errors';
import {
  OpenAICompatibleAdapter,
  OPENAI_PREFERRED,
  OPENAI_FALLBACK,
  XAI_PREFERRED,
  XAI_FALLBACK,
} from './providers/openai.provider';
import { AnthropicAdapter } from './providers/anthropic.provider';
import { GeminiAdapter } from './providers/gemini.provider';
import { MockAdapter } from './providers/mock.provider';

/**
 * Builds the correct provider adapter for a set of BYOK credentials. This is the
 * ONLY place provider selection happens; controllers/services stay provider-agnostic.
 */
export function createAdapter(
  creds: AICredentials,
  mockFallback?: (system: string, user: string) => string,
): AIProviderAdapter {
  switch (creds.provider) {
    case 'openai':
      return new OpenAICompatibleAdapter({
        id: 'openai',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: creds.apiKey,
        model: creds.model,
        preferred: OPENAI_PREFERRED,
        fallback: OPENAI_FALLBACK,
      });

    case 'xai':
      return new OpenAICompatibleAdapter({
        id: 'xai',
        label: 'xAI',
        baseUrl: 'https://api.x.ai/v1',
        apiKey: creds.apiKey,
        model: creds.model,
        preferred: XAI_PREFERRED,
        fallback: XAI_FALLBACK,
      });

    case 'openai-compatible': {
      if (!creds.baseUrl) throw new BadRequestError('A base URL is required for a custom provider');
      const baseUrl = assertSafeAiUrl(creds.baseUrl);
      const fallback = creds.model ? [creds.model] : [];
      return new OpenAICompatibleAdapter({
        id: 'openai-compatible',
        label: creds.providerName || 'Custom provider',
        baseUrl,
        apiKey: creds.apiKey,
        model: creds.model,
        preferred: creds.model ? [creds.model] : [],
        fallback,
      });
    }

    case 'anthropic':
      return new AnthropicAdapter(creds.apiKey, creds.model);

    case 'gemini':
      return new GeminiAdapter(creds.apiKey, creds.model);

    case 'mock':
      return new MockAdapter(mockFallback);

    default:
      throw new BadRequestError(`Unsupported AI provider: ${String(creds.provider)}`);
  }
}
