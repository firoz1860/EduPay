import { describe, it, expect } from 'vitest';
import { maskKey, assertSafeAiUrl, toUserFacingProviderError } from '../src/modules/ai/ai.security';

describe('maskKey', () => {
  it('shows only the last 4 characters', () => {
    const masked = maskKey('sk-secret-abcd1234');
    expect(masked.endsWith('1234')).toBe(true);
    expect(masked).not.toContain('secret');
    expect(masked).not.toContain('sk-secret');
  });
  it('never reveals short keys', () => {
    expect(maskKey('ab')).toBe('••••');
  });
});

describe('assertSafeAiUrl (SSRF guard, strict)', () => {
  it('accepts a public HTTPS URL', () => {
    expect(assertSafeAiUrl('https://api.example.com/v1', true)).toBe('https://api.example.com/v1');
  });
  it('rejects HTTP in strict mode', () => {
    expect(() => assertSafeAiUrl('http://api.example.com/v1', true)).toThrow();
  });
  it('rejects localhost / private / metadata hosts in strict mode', () => {
    expect(() => assertSafeAiUrl('https://localhost/v1', true)).toThrow();
    expect(() => assertSafeAiUrl('https://127.0.0.1/v1', true)).toThrow();
    expect(() => assertSafeAiUrl('https://10.0.0.5/v1', true)).toThrow();
    expect(() => assertSafeAiUrl('https://192.168.1.10/v1', true)).toThrow();
    expect(() => assertSafeAiUrl('https://169.254.169.254/v1', true)).toThrow();
    expect(() => assertSafeAiUrl('https://metadata.google.internal/v1', true)).toThrow();
  });
  it('allows http + localhost in non-strict (dev) mode', () => {
    expect(assertSafeAiUrl('http://localhost:1234/v1', false)).toBe('http://localhost:1234/v1');
  });
});

describe('toUserFacingProviderError', () => {
  it('maps statuses to safe, user-friendly messages without secrets', () => {
    const key = 'sk-super-secret-key';
    for (const status of [401, 403, 404, 429, 400, 500, 503]) {
      const err = toUserFacingProviderError(status, 'OpenAI');
      expect(err.message).not.toContain(key);
      expect(err.message).not.toContain('Bearer');
      expect(err.message.length).toBeGreaterThan(0);
    }
    expect(toUserFacingProviderError(401, 'OpenAI').code).toBe('AI_INVALID_KEY');
    expect(toUserFacingProviderError(429, 'OpenAI').statusCode).toBe(429);
  });
});
