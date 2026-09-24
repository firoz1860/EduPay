import { Prisma } from '@prisma/client';

export type ReconStatus =
  | 'MATCHED'
  | 'AMOUNT_MISMATCH'
  | 'MISSING_INTERNAL'
  | 'MISSING_GATEWAY'
  | 'DUPLICATE'
  | 'STATE_MISMATCH'
  | 'PENDING_REVIEW'
  | 'RESOLVED';

export interface ReconSide {
  reference: string | null;
  amount: Prisma.Decimal | number | string | null;
  status: string | null; // canonical internal status vocabulary
}

/** Normalizes provider status vocabularies to EduPay's canonical set. */
export function normalizeStatus(status: string | null | undefined): string {
  if (!status) return 'UNKNOWN';
  const s = status.toLowerCase();
  if (['succeeded', 'success', 'paid', 'complete', 'completed'].includes(s)) return 'SUCCESS';
  if (['failed', 'canceled', 'cancelled', 'declined'].includes(s)) return 'FAILED';
  if (['pending', 'processing', 'requires_action', 'created', 'requires_payment_method'].includes(s))
    return 'PENDING';
  return status.toUpperCase();
}

function toDec(v: Prisma.Decimal | number | string | null): Prisma.Decimal | null {
  if (v === null || v === undefined) return null;
  return new Prisma.Decimal(v);
}

export interface ClassifyResult {
  status: ReconStatus;
  discrepancyType: string | null;
  notes: string;
}

/**
 * Deterministic reconciliation comparison of an internal payment record against
 * the payment gateway's record. Pure function — no I/O — so it is exhaustively
 * unit-testable and its decisions are fully backend-controlled.
 */
export function classifyReconciliation(
  internal: ReconSide | null,
  gateway: ReconSide | null,
  opts: { duplicate?: boolean } = {},
): ClassifyResult {
  if (opts.duplicate) {
    return {
      status: 'DUPLICATE',
      discrepancyType: 'DUPLICATE_GATEWAY_REFERENCE',
      notes: 'Multiple internal records reference the same gateway transaction.',
    };
  }

  if (!internal && !gateway) {
    return { status: 'PENDING_REVIEW', discrepancyType: null, notes: 'No records to compare.' };
  }

  if (!internal && gateway) {
    return {
      status: 'MISSING_INTERNAL',
      discrepancyType: 'MISSING_INTERNAL',
      notes: `Gateway reports ${gateway.reference ?? 'a transaction'} but no internal payment exists.`,
    };
  }

  if (internal && !gateway) {
    return {
      status: 'MISSING_GATEWAY',
      discrepancyType: 'MISSING_GATEWAY',
      notes: `Internal payment ${internal.reference ?? ''} has no matching gateway record.`,
    };
  }

  // Both present.
  const a = toDec(internal!.amount);
  const b = toDec(gateway!.amount);
  const amountMismatch = a !== null && b !== null && !a.equals(b);

  const internalStatus = normalizeStatus(internal!.status);
  const gatewayStatus = normalizeStatus(gateway!.status);
  const stateMismatch = internalStatus !== gatewayStatus;

  if (amountMismatch) {
    return {
      status: 'AMOUNT_MISMATCH',
      discrepancyType: 'AMOUNT_MISMATCH',
      notes: `Internal amount ${a?.toString()} does not match gateway amount ${b?.toString()}.`,
    };
  }

  if (stateMismatch) {
    return {
      status: 'STATE_MISMATCH',
      discrepancyType: 'STATE_MISMATCH',
      notes: `Internal status ${internalStatus} does not match gateway status ${gatewayStatus}.`,
    };
  }

  return { status: 'MATCHED', discrepancyType: null, notes: 'Internal and gateway records agree.' };
}
