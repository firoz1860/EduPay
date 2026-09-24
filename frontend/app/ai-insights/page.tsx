'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/constants';
import { useAIConfig } from '@/providers/ai-config-provider';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Brain, Sparkles, Loader2, TrendingDown, TrendingUp, ShieldCheck, Cpu, KeyRound } from 'lucide-react';

interface VerifiedContext {
  totals: { totalFees: number; collected: number; outstanding: number; overdue: number };
  payments: { successful: number; failed: number; pending: number };
  refunds: { completedCount: number; completedAmount: number };
  reconciliation: {
    total: number;
    issues: number;
    byStatus: Record<string, number>;
    openExamples: {
      status: string;
      internal: string | null;
      internalAmount: number | null;
      gatewayAmount: number | null;
      notes: string | null;
    }[];
  };
  outstandingByDepartment: { department: string; outstanding: number; students: number }[];
}

interface InsightsResponse {
  provider: string;
  verifiedData: VerifiedContext;
  collectionHealth: string;
  reconciliationSummary: string;
}

interface AskResponse {
  answer: string;
  provider: string;
  verifiedData: VerifiedContext;
}

export default function AiInsightsPage() {
  const [question, setQuestion] = useState('');
  const { ready, openSetup, aiHeaders, provider, model } = useAIConfig();

  const { data: insights, isLoading } = useQuery({
    queryKey: ['ai', 'insights'],
    enabled: ready,
    queryFn: async () => (await api.get<InsightsResponse>('/ai/insights', undefined, { aiHeaders: aiHeaders() })).data,
  });

  const askMutation = useMutation({
    mutationFn: async (q: string) =>
      (await api.post<AskResponse>('/ai/ask', { question: q }, { aiHeaders: aiHeaders() })).data,
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to get an answer. Please try again.');
    },
  });

  // Gate: AI features require a configured BYOK provider for this session.
  if (!ready) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Insights" description="AI-assisted reconciliation and financial analysis" />
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
              <KeyRound className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <p className="text-base font-semibold">AI assistant isn&apos;t configured yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect your own AI provider to generate explanations from verified financial data.
                Your key is never stored by EduPay.
              </p>
            </div>
            <Button onClick={openSetup}>
              <Sparkles className="mr-2 h-4 w-4" /> Configure AI
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleAsk() {
    if (!question.trim()) return;
    askMutation.mutate(question);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Insights" description="AI-assisted reconciliation and financial analysis" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const ctx = insights?.verifiedData;
  const mismatchCount = ctx
    ? (ctx.reconciliation.byStatus.AMOUNT_MISMATCH || 0) + (ctx.reconciliation.byStatus.STATE_MISMATCH || 0)
    : 0;
  const missingCount = ctx
    ? (ctx.reconciliation.byStatus.MISSING_INTERNAL || 0) + (ctx.reconciliation.byStatus.MISSING_GATEWAY || 0)
    : 0;
  const matchedCount = ctx ? (ctx.reconciliation.byStatus.MATCHED || 0) : 0;
  const efficiency =
    ctx && ctx.totals.totalFees > 0 ? ((ctx.totals.collected / ctx.totals.totalFees) * 100).toFixed(1) : null;

  const suggestions = [
    'Which departments have the highest outstanding fees?',
    'Why are there unresolved reconciliation issues?',
    'Give me a collection summary',
    'What is the overdue situation?',
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="AI Insights" description="AI-assisted reconciliation and financial analysis" />

      {/* AI Disclaimer */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              AI Safety Notice
              {provider && (
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-normal text-blue-700">
                  Connected: {provider}{model ? ` · ${model}` : ''}
                </span>
              )}
            </p>
            <p className="text-sm text-blue-700">
              AI generates explanations and summaries based on verified backend data. It never makes financial decisions or modifies records directly.
              All calculations are deterministic and backend-controlled. Your API key is used only for your requests and is never stored by EduPay.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Generated Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-sm">Collection Health</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total collected: <span className="font-semibold">{formatCurrency(ctx?.totals.collected || 0)}</span></p>
            <p>Outstanding: <span className="font-semibold">{formatCurrency(ctx?.totals.outstanding || 0)}</span></p>
            <p>Overdue: <span className="font-semibold text-rose-600">{formatCurrency(ctx?.totals.overdue || 0)}</span></p>
            <p className="pt-2 text-xs text-muted-foreground">
              {efficiency !== null ? `Collection efficiency: ${efficiency}%` : 'No data available'}
            </p>
            {insights?.collectionHealth && (
              <p className="whitespace-pre-line border-t pt-2 text-xs text-muted-foreground">{insights.collectionHealth}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <TrendingDown className="h-4 w-4 text-amber-600" />
              </div>
              <CardTitle className="text-sm">Reconciliation Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Matched: <span className="font-semibold text-emerald-600">{matchedCount}</span></p>
            <p>Mismatches: <span className="font-semibold text-rose-600">{mismatchCount}</span></p>
            <p>Missing records: <span className="font-semibold text-amber-600">{missingCount}</span></p>
            <p className="pt-2 text-xs text-muted-foreground">
              {ctx && ctx.reconciliation.issues > 0
                ? `${ctx.reconciliation.issues} records need manual review`
                : 'All records reconciled successfully'}
            </p>
            {insights?.reconciliationSummary && (
              <p className="whitespace-pre-line border-t pt-2 text-xs text-muted-foreground">{insights.reconciliationSummary}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ask AI */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
              <Brain className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-base">Ask AI Assistant</CardTitle>
              <CardDescription>Ask questions about fees, payments, reconciliation, and more</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setQuestion(s)}
                className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                <Sparkles className="h-3 w-3 text-violet-500" />
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Ask a question about your financial data..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <Button onClick={handleAsk} disabled={!question.trim() || askMutation.isPending} className="shrink-0">
              {askMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Ask
            </Button>
          </div>

          {askMutation.data?.answer && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100">
                  <Brain className="h-3 w-3 text-violet-600" />
                </div>
                <span className="text-sm font-medium">AI Response</span>
              </div>
              <p className="whitespace-pre-line text-sm text-foreground">{askMutation.data.answer}</p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cpu className="h-3 w-3" />
                Generated from verified backend data by <span className="font-medium">{askMutation.data.provider}</span>. No financial records were modified.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
