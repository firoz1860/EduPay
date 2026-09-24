import { isProd } from '../../config/env';
import { AppError, BadRequestError } from '../../lib/errors';

/**
 * Security helpers for the BYOK AI subsystem. Central place for key masking,
 * SSRF-safe URL validation, and mapping raw provider errors to safe,
 * user-facing messages that NEVER contain the key or raw provider payloads.
 */

/** Timeout for any single provider HTTP call. AI must never block the app. */
export const AI_TIMEOUT_MS = 20_000;

/** Mask a key for display/audit context: keep only the last 4 chars. */
export function maskKey(key: string): string {
  const trimmed = (key ?? '').trim();
  if (trimmed.length <= 4) return '••••';
  return `${'•'.repeat(12)}${trimmed.slice(-4)}`;
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./, // link-local
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^\[?::1\]?$/, // IPv6 loopback
  /\.local$/i,
  /^metadata\.google\.internal$/i,
];

/**
 * Validates a custom (openai-compatible) base URL. In production only HTTPS is
 * allowed and private/loopback/link-local/metadata hosts are rejected to
 * prevent SSRF. Returns the normalized URL (trailing slash trimmed).
 */
export function assertSafeAiUrl(rawUrl: string, strict: boolean = isProd): string {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new BadRequestError('Invalid base URL');
  }

  if (strict) {
    if (url.protocol !== 'https:') {
      throw new BadRequestError('Base URL must use HTTPS in production');
    }
    const host = url.hostname;
    if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) {
      throw new BadRequestError('Base URL host is not allowed');
    }
  } else if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new BadRequestError('Base URL must be http(s)');
  }

  return url.toString().replace(/\/$/, '');
}

/**
 * Maps a provider HTTP status to a safe AppError. The raw provider body is
 * intentionally discarded so secrets/echoed headers never reach the client.
 */
export function toUserFacingProviderError(status: number, providerLabel: string): AppError {
  const label = providerLabel || 'The AI provider';
  if (status === 401) {
    return new AppError(400, 'AI_INVALID_KEY', `${label} rejected the API key. Please verify the key and provider.`);
  }
  if (status === 403) {
    return new AppError(400, 'AI_FORBIDDEN', `${label} denied access. Check the key's permissions or billing status.`);
  }
  if (status === 404) {
    return new AppError(400, 'AI_NOT_FOUND', `${label} could not find the requested model. Try another model.`);
  }
  if (status === 429) {
    return new AppError(429, 'AI_RATE_LIMITED', `${label} rate-limited this request. Please slow down and try again.`);
  }
  if (status === 400) {
    return new AppError(400, 'AI_BAD_REQUEST', `${label} rejected this request. Verify the selected model.`);
  }
  if (status >= 500) {
    return new AppError(502, 'AI_PROVIDER_UNAVAILABLE', `${label} is temporarily unavailable. Please try again later.`);
  }
  return new AppError(502, 'AI_PROVIDER_ERROR', `${label} returned an unexpected response.`);
}
