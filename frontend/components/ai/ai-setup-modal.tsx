'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { AI_PROVIDERS, providerMeta, type AIProviderId } from '@/lib/ai-providers';
import { useAIConfig } from '@/providers/ai-config-provider';
import { toast } from 'sonner';
import {
  Sparkles, Eye, EyeOff, ExternalLink, Loader2, ShieldCheck, CheckCircle2, HelpCircle, KeyRound,
} from 'lucide-react';

interface ValidateResponse {
  valid: boolean;
  provider: string;
  models: { id: string }[];
  suggestedModel: string | null;
}

function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 4) return '••••';
  return `${'•'.repeat(12)}${k.slice(-4)}`;
}

/**
 * Global BYOK setup modal. Rendered once at the app root and driven by the
 * AIConfig context. The key is held locally only until "Continue", then handed
 * to the context (session memory) — it is never stored or shown in full.
 */
export function AiSetupModal() {
  const { isSetupOpen, closeSetup, connect, dismiss, savedMeta } = useAIConfig();

  const [provider, setProvider] = useState<AIProviderId>(savedMeta?.provider ?? 'openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(savedMeta?.baseUrl ?? '');
  const [providerName, setProviderName] = useState(savedMeta?.providerName ?? '');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const meta = useMemo(() => providerMeta(provider), [provider]);

  function resetValidation() {
    setValidated(false);
    setModels([]);
    setModel('');
    setError(null);
  }

  function onProviderChange(id: string) {
    setProvider(id as AIProviderId);
    resetValidation();
  }

  async function handleValidate() {
    const key = apiKey.trim();
    if (!key) {
      setError('Please enter your API key.');
      return;
    }
    if (meta.needsBaseUrl && !baseUrl.trim()) {
      setError('Please enter the provider base URL.');
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const { data } = await api.post<ValidateResponse>('/ai/validate', {
        provider,
        apiKey: key,
        baseUrl: meta.needsBaseUrl ? baseUrl.trim() : undefined,
        providerName: meta.needsBaseUrl ? providerName.trim() || undefined : undefined,
      });
      const ids = data.models.map((m) => m.id);
      setModels(ids);
      setModel(data.suggestedModel ?? ids[0] ?? '');
      setValidated(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to verify this API key. Check the key, provider selection, permissions, or billing status.');
    } finally {
      setValidating(false);
    }
  }

  function handleContinue() {
    if (!validated || !model) return;
    connect({
      provider,
      model,
      apiKey: apiKey.trim(),
      baseUrl: meta.needsBaseUrl ? baseUrl.trim() : undefined,
      providerName: meta.needsBaseUrl ? providerName.trim() || undefined : undefined,
    });
    toast.success('AI provider connected');
    // Reset transient state (keep provider for next time).
    setApiKey('');
    setValidated(false);
    setShowKey(false);
  }

  function handleSkip() {
    dismiss();
    closeSetup();
  }

  return (
    <Dialog open={isSetupOpen} onOpenChange={(o) => (o ? null : closeSetup())}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
            <Sparkles className="h-6 w-6 text-violet-600" />
          </div>
          <DialogTitle className="text-center text-lg">Set up AI Assistant</DialogTitle>
          <DialogDescription className="text-center">
            To use EduPay&apos;s AI features, connect your own AI provider. Your API key is used only for
            your AI requests and is never stored in the EduPay database or source code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Provider */}
          <div className="space-y-1.5">
            <Label>AI Provider</Label>
            <Select value={provider} onValueChange={onProviderChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom base URL */}
          {meta.needsBaseUrl && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Provider name</Label>
                <Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="My provider" />
              </div>
              <div className="space-y-1.5">
                <Label>Base URL</Label>
                <Input value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); resetValidation(); }} placeholder="https://example.com/v1" />
              </div>
            </div>
          )}

          {/* API key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>API Key</Label>
              {meta.keyUrl && (
                <a
                  href={meta.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline"
                >
                  Get {meta.name} API Key <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {validated ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <span className="font-mono text-sm">{maskKey(apiKey)}</span>
                <button
                  type="button"
                  onClick={() => { resetValidation(); }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Use a different key
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={meta.keyPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>

          {/* Model (after validation) */}
          {validated && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> API key verified
              </div>
              <Label>Detected model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue placeholder="Select a model" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}

          {/* Why do I need a key */}
          <div>
            <button
              type="button"
              onClick={() => setShowWhy((s) => !s)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Why do I need an API key?
            </button>
            {showWhy && (
              <p className="mt-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                Your AI provider charges you directly. EduPay does not provide or include an AI API key.
                Your key is used only to make your own AI requests and never leaves your session beyond
                the secure request to your chosen provider.
              </p>
            )}
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50/60 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-xs text-blue-700">
              Your key is kept only in memory for this session, sent over HTTPS for your requests, and is
              never saved to the EduPay database. Refreshing will ask you to reconnect.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            {validated ? (
              <Button onClick={handleContinue} disabled={!model} className="w-full">
                <KeyRound className="mr-2 h-4 w-4" /> Continue to EduPay
              </Button>
            ) : (
              <Button onClick={handleValidate} disabled={validating} className="w-full">
                {validating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Validate &amp; Continue
              </Button>
            )}
            <Button variant="ghost" onClick={handleSkip} className="w-full text-muted-foreground">
              Continue without AI
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
