import { Prisma } from '@prisma/client';
import { add, round2, sub, gte, gt, ZERO } from '../lib/money';

export interface LineInput {
  amount: Prisma.Decimal.Value;
  discountAmount?: Prisma.Decimal.Value;
}

export interface InvoiceTotals {
  totalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  payableAmount: Prisma.Decimal;
}

/**
 * Computes invoice totals from line items — the single source of truth for
 * money on an invoice. Client-supplied totals are NEVER used.
 *
 * payable = sum(item.amount) - sum(item.discount) + tax
 */
export function computeInvoiceTotals(
  items: LineInput[],
  taxAmount: Prisma.Decimal.Value = 0,
): InvoiceTotals {
  const totalAmount = add(...items.map((i) => i.amount));
  const discountAmount = add(...items.map((i) => i.discountAmount ?? 0));
  const tax = round2(taxAmount);
  const payableAmount = round2(sub(add(totalAmount, tax), discountAmount));
  if (payableAmount.lessThan(0)) {
    throw new Error('Computed payable amount is negative — discount exceeds charges');
  }
  return { totalAmount, discountAmount, taxAmount: tax, payableAmount };
}

export type DerivableInvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

/**
 * Derives the invoice status from money + due date. Terminal states
 * (DRAFT, CANCELLED) are managed explicitly by the service, not here.
 */
export function deriveInvoiceStatus(
  payableAmount: Prisma.Decimal.Value,
  paidAmount: Prisma.Decimal.Value,
  dueDate: Date | null,
  now: Date = new Date(),
): DerivableInvoiceStatus {
  const paid = round2(paidAmount);
  const payable = round2(payableAmount);

  if (gte(paid, payable) && gt(payable, ZERO)) return 'PAID';
  if (gt(paid, ZERO)) {
    // partially paid; overdue takes precedence for reporting if past due
    if (dueDate && now > dueDate) return 'OVERDUE';
    return 'PARTIALLY_PAID';
  }
  if (dueDate && now > dueDate) return 'OVERDUE';
  return 'ISSUED';
}

export type DerivableInstallmentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export function deriveInstallmentStatus(
  amount: Prisma.Decimal.Value,
  paidAmount: Prisma.Decimal.Value,
  dueDate: Date | null,
  now: Date = new Date(),
): DerivableInstallmentStatus {
  const paid = round2(paidAmount);
  const total = round2(amount);
  if (gte(paid, total) && gt(total, ZERO)) return 'PAID';
  if (gt(paid, ZERO)) return 'PARTIALLY_PAID';
  if (dueDate && now > dueDate) return 'OVERDUE';
  return 'PENDING';
}

export interface OutstandingResult {
  outstandingAmount: Prisma.Decimal;
}

export function computeOutstanding(
  payableAmount: Prisma.Decimal.Value,
  paidAmount: Prisma.Decimal.Value,
): Prisma.Decimal {
  const outstanding = sub(payableAmount, paidAmount);
  return outstanding.lessThan(0) ? ZERO : outstanding;
}
