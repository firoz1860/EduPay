import { buildVerifiedContext, type VerifiedContext } from './ai.context';
import { selectProvider } from './ai.provider';
import { logger } from '../../lib/logger';

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const SYSTEM_PROMPT = `You are EduPay's financial reporting assistant.
Rules you MUST follow:
- You ONLY explain, summarize and classify. You NEVER make or imply financial decisions and you NEVER modify records.
- You may ONLY use the figures provided in the VERIFIED DATA JSON. Never invent or estimate numbers.
- If the data needed to answer is not present, clearly state that the information is unavailable.
- Be concise, factual and professional. Use ₹ for currency.`;

/** Deterministic natural-language answer built ONLY from verified figures. */
function renderFallback(question: string, ctx: VerifiedContext): string {
  const q = question.toLowerCase();

  if (q.includes('department') && (q.includes('outstanding') || q.includes('due'))) {
    if (ctx.outstandingByDepartment.length === 0) return 'There are currently no outstanding fees by department.';
    const lines = ctx.outstandingByDepartment
      .map((d) => `• ${d.department}: ${INR(d.outstanding)} outstanding across ${d.students} student(s)`)
      .join('\n');
    return `Outstanding fees by department (highest first):\n${lines}`;
  }

  if (q.includes('reconcil') || q.includes('discrepanc') || q.includes('mismatch')) {
    const parts = Object.entries(ctx.reconciliation.byStatus)
      .map(([s, n]) => `${n} ${s}`)
      .join(', ');
    const examples = ctx.reconciliation.openExamples
      .map((e) => `  - ${e.status}: internal ${e.internal ?? 'n/a'} (${e.internalAmount != null ? INR(e.internalAmount) : 'n/a'}) vs gateway ${e.gatewayAmount != null ? INR(e.gatewayAmount) : 'n/a'} — ${e.notes ?? ''}`)
      .join('\n');
    return (
      `There are ${ctx.reconciliation.issues} unresolved reconciliation record(s) out of ${ctx.reconciliation.total} total.\n` +
      `Breakdown: ${parts || 'none'}.` +
      (examples ? `\nOpen examples:\n${examples}` : '') +
      `\nThese are flagged deterministically by the backend; a finance manager must review and resolve each one.`
    );
  }

  if (q.includes('overdue')) {
    return `The total overdue outstanding amount is ${INR(ctx.totals.overdue)}. Overdue invoices are past their due date and still have a balance.`;
  }

  if (q.includes('fail')) {
    return `There are ${ctx.payments.failed} failed payment(s) and ${ctx.payments.pending} pending. Failed payments never move money; the idempotent settlement flow prevents duplicate charges on retry.`;
  }

  // Default: collection summary.
  const efficiency =
    ctx.totals.totalFees > 0 ? ((ctx.totals.collected / ctx.totals.totalFees) * 100).toFixed(1) : '0';
  return (
    `Collection summary (verified backend figures):\n` +
    `• Total billable: ${INR(ctx.totals.totalFees)}\n` +
    `• Collected: ${INR(ctx.totals.collected)}\n` +
    `• Outstanding: ${INR(ctx.totals.outstanding)}\n` +
    `• Overdue: ${INR(ctx.totals.overdue)}\n` +
    `• Payments — success: ${ctx.payments.successful}, pending: ${ctx.payments.pending}, failed: ${ctx.payments.failed}\n` +
    `• Refunds completed: ${ctx.refunds.completedCount} (${INR(ctx.refunds.completedAmount)})\n` +
    `• Unresolved reconciliation issues: ${ctx.reconciliation.issues}\n` +
    `Collection efficiency is approximately ${efficiency}% of total billable amount.`
  );
}

export interface AskResult {
  answer: string;
  provider: string;
  verifiedData: VerifiedContext;
}

/**
 * Answers an analytical question. The backend first computes verified figures,
 * then hands them to the AI provider purely to phrase an explanation. The mock
 * provider returns the deterministic fallback; a real provider is instructed to
 * use only the supplied figures.
 */
export async function ask(question: string): Promise<AskResult> {
  const ctx = await buildVerifiedContext();
  const provider = selectProvider(() => renderFallback(question, ctx));

  const userPayload =
    `QUESTION: ${question}\n\n` +
    `VERIFIED DATA (JSON, the only figures you may cite):\n${JSON.stringify(ctx, null, 2)}`;

  let answer: string;
  try {
    answer = await provider.complete(SYSTEM_PROMPT, userPayload);
  } catch (err) {
    logger.warn({ err }, 'AI provider failed; using deterministic fallback');
    answer = renderFallback(question, ctx);
  }

  return { answer, provider: provider.name, verifiedData: ctx };
}

export interface InsightsResult {
  provider: string;
  verifiedData: VerifiedContext;
  collectionHealth: string;
  reconciliationSummary: string;
}

/** Auto-generated dashboard insights, always from verified data. */
export async function insights(): Promise<InsightsResult> {
  const ctx = await buildVerifiedContext();
  return {
    provider: selectProvider(() => '').name,
    verifiedData: ctx,
    collectionHealth: renderFallback('collection summary', ctx),
    reconciliationSummary: renderFallback('reconciliation issues', ctx),
  };
}
