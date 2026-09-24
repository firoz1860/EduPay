/** BYOK AI provider types shared across adapters, factory and service. */

export type AIProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'xai'
  | 'openai-compatible'
  | 'mock';

export const AI_PROVIDER_IDS: AIProviderId[] = [
  'openai',
  'anthropic',
  'gemini',
  'xai',
  'openai-compatible',
  'mock',
];

/**
 * A user's Bring-Your-Own-Key credentials. The raw `apiKey` lives only in
 * memory for the duration of a single request and is NEVER persisted or logged.
 */
export interface AICredentials {
  provider: AIProviderId;
  apiKey: string;
  model?: string;
  /** Required for openai-compatible providers. */
  baseUrl?: string;
  /** Optional human label for a custom provider. */
  providerName?: string;
}

export interface ModelInfo {
  id: string;
  label?: string;
}

export interface ValidateResult {
  valid: boolean;
  provider: AIProviderId;
  models: ModelInfo[];
  suggestedModel: string | null;
}

/**
 * Provider adapter contract. Implementations isolate all provider-specific HTTP
 * so controllers/services never contain provider branching.
 */
export interface AIProviderAdapter {
  readonly id: AIProviderId;
  /** Verify the key with a minimal real request; returns available models. */
  validateKey(): Promise<ValidateResult>;
  /** List models the key can access (best-effort; falls back to a known list). */
  listModels(): Promise<ModelInfo[]>;
  /** Produce a text completion. `system` + `user` are already-composed prompts. */
  generateResponse(system: string, user: string): Promise<string>;
}
