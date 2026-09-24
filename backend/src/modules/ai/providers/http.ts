import { AppError } from '../../../lib/errors';
import { AI_TIMEOUT_MS } from '../ai.security';

/**
 * fetch() with an enforced timeout via AbortController. Network/timeout failures
 * become safe AppErrors (no key/URL leakage). Provider non-2xx handling is done
 * by callers with `toUserFacingProviderError`.
 */
export async function providerFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AppError(504, 'AI_TIMEOUT', 'The AI provider took too long to respond. Please try again.');
    }
    throw new AppError(502, 'AI_NETWORK_ERROR', 'Could not reach the AI provider. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

/** Read a response body as JSON without throwing (returns null on failure). */
export async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
