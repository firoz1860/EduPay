'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AIProviderId } from '@/lib/ai-providers';
import { api } from '@/lib/api';

/**
 * BYOK AI session configuration.
 *
 * SECURITY MODEL:
 * - The raw API key lives ONLY in this provider's in-memory React state for the
 *   active session. It is never written to localStorage/sessionStorage, never
 *   persisted, and is sent to the backend only via per-request X-AI-* headers.
 * - Only SAFE, non-secret metadata (provider, model, providerName) is remembered
 *   in localStorage so the setup modal can prefill and Settings can display it.
 * - On refresh/restart the key is gone -> `ready` is false -> the setup modal
 *   reappears. This is intentional (we never store third-party secrets).
 */

const META_KEY = 'edupay_ai_meta';

export interface AISessionConfig {
  provider: AIProviderId;
  model: string;
  apiKey: string;
  baseUrl?: string;
  providerName?: string;
}

interface AIMeta {
  provider: AIProviderId;
  model: string;
  baseUrl?: string;
  providerName?: string;
}

interface AIConfigContextType {
  /** True when a key is present in memory this session (AI features usable). */
  ready: boolean;
  /** Non-secret metadata remembered across sessions (for prefill / display). */
  savedMeta: AIMeta | null;
  provider: AIProviderId | null;
  model: string | null;
  /** Headers to attach to AI requests (empty when not configured). */
  aiHeaders: () => Record<string, string>;
  connect: (config: AISessionConfig) => void;
  disconnect: () => void;
  // Global setup-modal control.
  isSetupOpen: boolean;
  openSetup: () => void;
  closeSetup: () => void;
  /** User chose "continue without AI" this session (don't auto-nag again). */
  dismissed: boolean;
  dismiss: () => void;
}

const AIConfigContext = createContext<AIConfigContextType | null>(null);

export function AIConfigProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null); // memory only
  const [session, setSession] = useState<AISessionConfig | null>(null);
  const [savedMeta, setSavedMeta] = useState<AIMeta | null>(null);
  const [isSetupOpen, setSetupOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Restore non-secret metadata (never a key) on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) setSavedMeta(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const connect = useCallback((config: AISessionConfig) => {
    setApiKey(config.apiKey);
    setSession(config);
    const meta: AIMeta = {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      providerName: config.providerName,
    };
    setSavedMeta(meta);
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {
      /* ignore */
    }
    // Audit the connection server-side (metadata only, never the key).
    api.post('/ai/connect', { provider: config.provider, model: config.model }).catch(() => undefined);
    setSetupOpen(false);
  }, []);

  const disconnect = useCallback(() => {
    setApiKey(null);
    setSession(null);
    setSavedMeta(null);
    try {
      localStorage.removeItem(META_KEY);
    } catch {
      /* ignore */
    }
    api.post('/ai/disconnect').catch(() => undefined);
  }, []);

  const openSetup = useCallback(() => setSetupOpen(true), []);
  const closeSetup = useCallback(() => setSetupOpen(false), []);
  const dismiss = useCallback(() => setDismissed(true), []);

  const aiHeaders = useCallback((): Record<string, string> => {
    if (!apiKey || !session) return {};
    const h: Record<string, string> = {
      'X-AI-Provider': session.provider,
      'X-AI-Key': apiKey,
    };
    if (session.model) h['X-AI-Model'] = session.model;
    if (session.baseUrl) h['X-AI-Base-Url'] = session.baseUrl;
    if (session.providerName) h['X-AI-Provider-Name'] = session.providerName;
    return h;
  }, [apiKey, session]);

  const value: AIConfigContextType = {
    ready: !!apiKey,
    savedMeta,
    provider: session?.provider ?? savedMeta?.provider ?? null,
    model: session?.model ?? savedMeta?.model ?? null,
    aiHeaders,
    connect,
    disconnect,
    isSetupOpen,
    openSetup,
    closeSetup,
    dismissed,
    dismiss,
  };

  return <AIConfigContext.Provider value={value}>{children}</AIConfigContext.Provider>;
}

export function useAIConfig() {
  const ctx = useContext(AIConfigContext);
  if (!ctx) throw new Error('useAIConfig must be used within AIConfigProvider');
  return ctx;
}
