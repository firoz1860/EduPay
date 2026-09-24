import type { AIProviderAdapter, ModelInfo, ValidateResult } from '../ai.types';

/**
 * Deterministic development provider. Requires no key. It never invents figures —
 * the caller passes an already-composed prompt built from verified data, and the
 * service uses its own deterministic renderer for the mock path.
 */
export class MockAdapter implements AIProviderAdapter {
  readonly id = 'mock' as const;
  private readonly fallback: (system: string, user: string) => string;

  constructor(fallback: (system: string, user: string) => string = () => 'Mock AI response.') {
    this.fallback = fallback;
  }

  async validateKey(): Promise<ValidateResult> {
    const models: ModelInfo[] = [{ id: 'mock-model' }];
    return { valid: true, provider: this.id, models, suggestedModel: 'mock-model' };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [{ id: 'mock-model' }];
  }

  async generateResponse(system: string, user: string): Promise<string> {
    return this.fallback(system, user);
  }
}
