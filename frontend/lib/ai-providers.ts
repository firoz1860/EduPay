export type AIProviderId = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'openai-compatible';

export interface AIProviderMeta {
  id: AIProviderId;
  name: string;
  /** Official "create API key" page (opens in a new tab). */
  keyUrl: string;
  docsUrl: string;
  keyPlaceholder: string;
  needsBaseUrl: boolean;
}

/** Provider catalogue. Links are official provider pages only. */
export const AI_PROVIDERS: AIProviderMeta[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs',
    keyPlaceholder: 'sk-••••••••••••••••',
    needsBaseUrl: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com',
    keyPlaceholder: 'sk-ant-••••••••••••',
    needsBaseUrl: false,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    keyPlaceholder: 'AIza••••••••••••',
    needsBaseUrl: false,
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    keyUrl: 'https://console.x.ai/',
    docsUrl: 'https://docs.x.ai',
    keyPlaceholder: 'xai-••••••••••••',
    needsBaseUrl: false,
  },
  {
    id: 'openai-compatible',
    name: 'Custom (OpenAI-compatible)',
    keyUrl: '',
    docsUrl: '',
    keyPlaceholder: 'your-api-key',
    needsBaseUrl: true,
  },
];

export function providerMeta(id: AIProviderId): AIProviderMeta {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}
