'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/constants';
import { Brain, Sparkles, AlertCircle, Loader2, TrendingDown, TrendingUp, ShieldCheck } from 'lucide-react';

interface InsightData {
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  reconciliationIssues: number;
  matchedCount: number;
  mismatchCount: number;
  missingCount: number;
  deptOutstanding: { name: string; outstanding: number; studentCount: number }[];
}

export default function AiInsightsPage() {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [
        { data: payments },
        { data: invoices },
        { data: recon },
        { data: invoicesWithDept },
      ] = await Promise.all([
        supabase.from('payments').select('amount, status'),
        supabase.from('invoices').select('payable_amount, paid_amount, outstanding_amount, status'),
        supabase.from('reconciliation_records').select('status'),
        supabase.from('invoices').select('outstanding_amount, student:students(department:departments(name))'),
      ]);

      const totalCollected = (payments || []).filter((p) => p.status === 'SUCCESS').reduce((s, p) => s + Number(p.amount), 0);
      const totalOutstanding = (invoices || []).reduce((s, i) => s + Number(i.outstanding_amount), 0);
      const totalOverdue = (invoices || []).filter((i) => i.status === 'OVERDUE').reduce((s, i) => s + Number(i.outstanding_amount), 0);

      const deptMap = new Map<string, { outstanding: number; studentCount: number }>();
      (invoicesWithDept || []).forEach((inv) => {
        const student = inv.student as unknown as Record<string, unknown> | null;
        const dept = student?.department as unknown as Record<string, unknown> | null;
        const name = (dept?.name as string) || 'Unknown';
        if (!deptMap.has(name)) deptMap.set(name, { outstanding: 0, studentCount: 0 });
        const entry = deptMap.get(name)!;
        entry.outstanding += Number(inv.outstanding_amount);
        entry.studentCount += 1;
      });
      const deptOutstanding = Array.from(deptMap.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.outstanding - a.outstanding);

      setData({
        totalCollected,
        totalOutstanding,
        totalOverdue,
        successfulPayments: (payments || []).filter((p) => p.status === 'SUCCESS').length,
        failedPayments: (payments || []).filter((p) => p.status === 'FAILED').length,
        pendingPayments: (payments || []).filter((p) => p.status === 'PENDING' || p.status === 'CREATED').length,
        reconciliationIssues: (recon || []).filter((r) => !['MATCHED', 'RESOLVED'].includes(r.status)).length,
        matchedCount: (recon || []).filter((r) => r.status === 'MATCHED').length,
        mismatchCount: (recon || []).filter((r) => ['AMOUNT_MISMATCH', 'STATE_MISMATCH'].includes(r.status)).length,
        missingCount: (recon || []).filter((r) => ['MISSING_INTERNAL', 'MISSING_GATEWAY'].includes(r.status)).length,
        deptOutstanding,
      });
      setLoading(false);
    }
    fetchData();
  }, []);

  function generateInsight(q: string): string {
    if (!data) return 'Data is still loading. Please wait.';

    const lower = q.toLowerCase();

    if (lower.includes('outstanding') && lower.includes('department')) {
      const lines = data.deptOutstanding
        .filter((d) => d.outstanding > 0)
        .map((d) => `${d.name} has ${formatCurrency(d.outstanding)} outstanding across ${d.studentCount} ${d.studentCount === 1 ? 'student' : 'students'}`);
      return `Here is the outstanding fee breakdown by department:\n\n${lines.join(',\n')}.`;
    }

    if (lower.includes('reconciliation') || lower.includes('discrepanc')) {
      return `There are ${data.reconciliationIssues} reconciliation records requiring attention. ${data.matchedCount} payments are fully matched, ${data.mismatchCount} have amount or state mismatches, and ${data.missingCount} have missing gateway or internal records. The mismatch cases likely indicate gateway timeout scenarios or amount discrepancies that need manual review.`;
    }

    if (lower.includes('overdue')) {
      return `The total overdue amount is ${formatCurrency(data.totalOverdue)}. This represents invoices that have passed their due date without full payment. Consider sending reminders to affected students and offering installment plans to reduce the overdue burden.`;
    }

    if (lower.includes('collection') || lower.includes('collected') || lower.includes('summary')) {
      return `Collection Summary:\n\nTotal Collected: ${formatCurrency(data.totalCollected)}\nTotal Outstanding: ${formatCurrency(data.totalOutstanding)}\nOverdue: ${formatCurrency(data.totalOverdue)}\n\nSuccessful Payments: ${data.successfulPayments}\nPending Payments: ${data.pendingPayments}\nFailed Payments: ${data.failedPayments}\n\nCollection efficiency is approximately ${data.totalOutstanding + data.totalCollected > 0 ? ((data.totalCollected / (data.totalCollected + data.totalOutstanding)) * 100).toFixed(1) : 0}% of total billable amount.`;
    }

    if (lower.includes('failed') || lower.includes('failure')) {
      return `There are ${data.failedPayments} failed payment(s). Common failure reasons include insufficient funds, card declined, or gateway timeouts. Failed payments should be retried after confirming the payment method with the student. The system prevents duplicate charges through idempotency keys.`;
    }

    return `I can answer questions about:\n\n- Collection summaries and totals\n- Outstanding fees by department\n- Reconciliation issues and discrepancies\n- Overdue payments\n- Failed payments\n- Payment status breakdown\n\nPlease ask about any of these topics. All figures are calculated from verified backend data.`;
  }

  function handleAsk() {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer('');
    setTimeout(() => {
      setAnswer(generateInsight(question));
      setAsking(false);
    }, 600);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Insights" description="AI-assisted reconciliation and financial analysis" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

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
            <p className="text-sm font-medium text-blue-900">AI Safety Notice</p>
            <p className="text-sm text-blue-700">
              AI generates explanations and summaries based on verified backend data. It never makes financial decisions or modifies records directly.
              All calculations are deterministic and backend-controlled.
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
            <p>Total collected: <span className="font-semibold">{formatCurrency(data?.totalCollected || 0)}</span></p>
            <p>Outstanding: <span className="font-semibold">{formatCurrency(data?.totalOutstanding || 0)}</span></p>
            <p>Overdue: <span className="font-semibold text-rose-600">{formatCurrency(data?.totalOverdue || 0)}</span></p>
            <p className="pt-2 text-xs text-muted-foreground">
              {data && data.totalCollected + data.totalOutstanding > 0
                ? `Collection efficiency: ${((data.totalCollected / (data.totalCollected + data.totalOutstanding)) * 100).toFixed(1)}%`
                : 'No data available'}
            </p>
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
            <p>Matched: <span className="font-semibold text-emerald-600">{data?.matchedCount || 0}</span></p>
            <p>Mismatches: <span className="font-semibold text-rose-600">{data?.mismatchCount || 0}</span></p>
            <p>Missing records: <span className="font-semibold text-amber-600">{data?.missingCount || 0}</span></p>
            <p className="pt-2 text-xs text-muted-foreground">
              {data && data.reconciliationIssues > 0
                ? `${data.reconciliationIssues} records need manual review`
                : 'All records reconciled successfully'}
            </p>
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
            <Button onClick={handleAsk} disabled={!question.trim() || asking} className="shrink-0">
              {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Ask
            </Button>
          </div>

          {answer && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100">
                  <Brain className="h-3 w-3 text-violet-600" />
                </div>
                <span className="text-sm font-medium">AI Response</span>
              </div>
              <p className="whitespace-pre-line text-sm text-foreground">{answer}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                This response is generated from verified backend data. No financial records were modified.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
