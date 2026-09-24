import { buildVerifiedContext, type VerifiedContext } from './ai.context';
import { createAdapter } from './provider.factory';
import type { AICredentials, ValidateResult, ModelInfo } from './ai.types';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
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
    const parts = Object.entries(ctx.reconciliation.byStatus).map(([s, n]) => `${n} ${s}`).join(', ');
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

  const efficiency = ctx.totals.totalFees > 0 ? ((ctx.totals.collected / ctx.totals.totalFees) * 100).toFixed(1) : '0';
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

function composeUserPayload(question: string, ctx: VerifiedContext): string {
  return `QUESTION: ${question}\n\nVERIFIED DATA (JSON, the only figures you may cite):\n${JSON.stringify(ctx, null, 2)}`;
}

/** Validate a provider key and discover models. Never returns/persists the key. */
export async function validateCredentials(creds: AICredentials): Promise<ValidateResult> {
  const adapter = createAdapter(creds);
  return adapter.validateKey();
}

export async function listModels(creds: AICredentials): Promise<ModelInfo[]> {
  const adapter = createAdapter(creds);
  return adapter.listModels();
}

export interface AskResult {
  answer: string;
  provider: string;
  verifiedData: VerifiedContext;
}

/**
 * Answer an analytical question. Verified figures are computed first, then handed
 * to the user's BYOK provider purely to phrase an explanation. Falls back to the
 * deterministic renderer for the mock provider / dev mode. Never mutates data.
 */
export async function ask(question: string, creds: AICredentials | null): Promise<AskResult> {
  const ctx = await buildVerifiedContext();

  // No BYOK key this session: allow the deterministic mock path only in dev/mock mode.
  if (!creds) {
    if (env.AI_PROVIDER === 'mock') {
      return { answer: renderFallback(question, ctx), provider: 'mock', verifiedData: ctx };
    }
    throw new AppError(400, 'AI_NOT_CONFIGURED', 'Connect your AI provider to use the assistant.');
  }

  const adapter = createAdapter(creds, () => renderFallback(question, ctx));
  try {
    const answer = await adapter.generateResponse(SYSTEM_PROMPT, composeUserPayload(question, ctx));
    return { answer, provider: creds.provider, verifiedData: ctx };
  } catch (err) {
    // Provider errors are already sanitized (no key leakage); surface them as-is.
    if (err instanceof AppError) throw err;
    logger.warn({ err }, 'AI generateResponse failed');
    throw new AppError(502, 'AI_PROVIDER_ERROR', 'The AI provider could not complete this request.');
  }
}

export interface InsightsResult {
  provider: string;
  verifiedData: VerifiedContext;
  collectionHealth: string;
  reconciliationSummary: string;
}

/**
 * Dashboard insights. Deterministic + always available (the numbers are the
 * value); does not spend a provider call. `provider` reflects the session config.
 */
export async function insights(creds: AICredentials | null): Promise<InsightsResult> {
  const ctx = await buildVerifiedContext();
  return {
    provider: creds?.provider ?? (env.AI_PROVIDER === 'mock' ? 'mock' : 'deterministic'),
    verifiedData: ctx,
    collectionHealth: renderFallback('collection summary', ctx),
    reconciliationSummary: renderFallback('reconciliation issues', ctx),
  };
}

export interface ReconSummaryResult {
  summary: string;
  provider: string;
  verifiedData: VerifiedContext;
}

/** Reconciliation summary — provider-phrased when configured, else deterministic. */
export async function reconciliationSummary(creds: AICredentials | null): Promise<ReconSummaryResult> {
  const ctx = await buildVerifiedContext();
  const question = 'Summarize the current reconciliation issues and what needs attention.';
  if (!creds) {
    return { summary: renderFallback('reconciliation issues', ctx), provider: env.AI_PROVIDER === 'mock' ? 'mock' : 'deterministic', verifiedData: ctx };
  }
  const adapter = createAdapter(creds, () => renderFallback('reconciliation issues', ctx));
  try {
    const summary = await adapter.generateResponse(SYSTEM_PROMPT, composeUserPayload(question, ctx));
    return { summary, provider: creds.provider, verifiedData: ctx };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'AI_PROVIDER_ERROR', 'The AI provider could not complete this request.');
  }
}

export { renderFallback };
