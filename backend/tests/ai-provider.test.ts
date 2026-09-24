import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAdapter } from '../src/modules/ai/provider.factory';
import { credentialsFromHeaders } from '../src/modules/ai/ai.credentials';
import { pickModel } from '../src/modules/ai/providers/openai.provider';
import type { Request } from 'express';

const SECRET = 'sk-test-do-not-leak-4242';

function mockRes(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('provider factory', () => {
  it('builds the right adapter per provider id', () => {
    expect(createAdapter({ provider: 'openai', apiKey: SECRET }).id).toBe('openai');
    expect(createAdapter({ provider: 'anthropic', apiKey: SECRET }).id).toBe('anthropic');
    expect(createAdapter({ provider: 'gemini', apiKey: SECRET }).id).toBe('gemini');
    expect(createAdapter({ provider: 'xai', apiKey: SECRET }).id).toBe('xai');
    expect(createAdapter({ provider: 'openai-compatible', apiKey: SECRET, baseUrl: 'https://x.example.com/v1', model: 'm' }).id).toBe('openai-compatible');
    expect(createAdapter({ provider: 'mock', apiKey: '' }).id).toBe('mock');
  });

  it('rejects a custom provider without a base URL', () => {
    expect(() => createAdapter({ provider: 'openai-compatible', apiKey: SECRET })).toThrow();
  });
});

describe('pickModel', () => {
  it('prefers the first preferred model present', () => {
    expect(pickModel([{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }], ['gpt-4o-mini', 'gpt-4o'])).toBe('gpt-4o-mini');
  });
  it('falls back to the first model when no preference matches', () => {
    expect(pickModel([{ id: 'x' }, { id: 'y' }], ['z'])).toBe('x');
  });
});

describe('OpenAI-compatible adapter', () => {
  it('validates a key and auto-detects the preferred model', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockRes(200, { data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] }),
    );
    const adapter = createAdapter({ provider: 'openai', apiKey: SECRET });
    const result = await adapter.validateKey();
    expect(result.valid).toBe(true);
    expect(result.models.map((m) => m.id)).toContain('gpt-4o-mini');
    expect(result.suggestedModel).toBe('gpt-4o-mini');
  });

  it('throws a sanitized error on 401 that never contains the key', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockRes(401, { error: 'bad key' }));
    const adapter = createAdapter({ provider: 'openai', apiKey: SECRET });
    await expect(adapter.validateKey()).rejects.toMatchObject({ code: 'AI_INVALID_KEY' });
    try {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockRes(401, { error: 'bad key' }));
      await adapter.validateKey();
    } catch (e) {
      expect((e as Error).message).not.toContain(SECRET);
    }
  });

  it('maps provider 429 to a rate-limit error', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockRes(429, {}));
    const adapter = createAdapter({ provider: 'openai', apiKey: SECRET });
    await expect(adapter.validateKey()).rejects.toMatchObject({ code: 'AI_RATE_LIMITED' });
  });

  it('generates a response from chat completions', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockRes(200, { choices: [{ message: { content: 'Hello from AI' } }] }),
    );
    const adapter = createAdapter({ provider: 'openai', apiKey: SECRET, model: 'gpt-4o-mini' });
    const text = await adapter.generateResponse('sys', 'user');
    expect(text).toBe('Hello from AI');
  });

  it('lists fallback models when the provider call fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockRes(500, {}));
    const adapter = createAdapter({ provider: 'openai', apiKey: SECRET });
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThan(0);
  });
});

describe('credentialsFromHeaders', () => {
  const makeReq = (headers: Record<string, string>) =>
    ({ header: (h: string) => headers[h.toLowerCase()] }) as unknown as Request;

  it('returns null when no key header is present', () => {
    expect(credentialsFromHeaders(makeReq({ 'x-ai-provider': 'openai' }))).toBeNull();
  });

  it('parses provider + key + model from headers', () => {
    const creds = credentialsFromHeaders(
      makeReq({ 'x-ai-provider': 'openai', 'x-ai-key': SECRET, 'x-ai-model': 'gpt-4o-mini' }),
    );
    expect(creds).toMatchObject({ provider: 'openai', apiKey: SECRET, model: 'gpt-4o-mini' });
  });

  it('rejects an unknown provider', () => {
    expect(credentialsFromHeaders(makeReq({ 'x-ai-provider': 'evilcorp', 'x-ai-key': SECRET }))).toBeNull();
  });
});
