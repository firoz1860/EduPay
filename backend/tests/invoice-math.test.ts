import { describe, it, expect } from 'vitest';
import {
  computeInvoiceTotals,
  deriveInvoiceStatus,
  deriveInstallmentStatus,
  computeOutstanding,
} from '../src/services/invoice-math';

describe('computeInvoiceTotals', () => {
  it('computes payable = charges - discounts + tax (backend authoritative)', () => {
    const totals = computeInvoiceTotals(
      [
        { amount: 50000, discountAmount: 10000 }, // tuition w/ scholarship
        { amount: 20000 }, // hostel
        { amount: 5000 }, // library
        { amount: 3000 }, // exam
      ],
      0,
    );
    expect(toStr(totals.totalAmount)).toBe('78000');
    expect(toStr(totals.discountAmount)).toBe('10000');
    expect(toStr(totals.payableAmount)).toBe('68000');
  });

  it('applies the scholarship example: 50000 - 10000 = 40000 net', () => {
    const totals = computeInvoiceTotals([{ amount: 50000, discountAmount: 10000 }]);
    expect(toStr(totals.payableAmount)).toBe('40000');
  });

  it('throws when discount exceeds charges (negative payable)', () => {
    expect(() => computeInvoiceTotals([{ amount: 100, discountAmount: 500 }])).toThrow();
  });
});

describe('deriveInvoiceStatus', () => {
  const future = new Date(Date.now() + 864e5);
  const past = new Date(Date.now() - 864e5);

  it('PAID when fully paid', () => {
    expect(deriveInvoiceStatus(1000, 1000, future)).toBe('PAID');
  });
  it('PARTIALLY_PAID when partial and not overdue', () => {
    expect(deriveInvoiceStatus(1000, 400, future)).toBe('PARTIALLY_PAID');
  });
  it('OVERDUE when partial and past due', () => {
    expect(deriveInvoiceStatus(1000, 400, past)).toBe('OVERDUE');
  });
  it('ISSUED when nothing paid and not due', () => {
    expect(deriveInvoiceStatus(1000, 0, future)).toBe('ISSUED');
  });
  it('OVERDUE when nothing paid and past due', () => {
    expect(deriveInvoiceStatus(1000, 0, past)).toBe('OVERDUE');
  });
});

describe('deriveInstallmentStatus', () => {
  it('PAID / PARTIALLY_PAID / PENDING', () => {
    expect(deriveInstallmentStatus(1000, 1000, null)).toBe('PAID');
    expect(deriveInstallmentStatus(1000, 300, null)).toBe('PARTIALLY_PAID');
    expect(deriveInstallmentStatus(1000, 0, null)).toBe('PENDING');
  });
});

describe('computeOutstanding', () => {
  it('never returns negative (overpayment clamps to 0)', () => {
    expect(toStr(computeOutstanding(1000, 1200))).toBe('0');
    expect(toStr(computeOutstanding(1000, 600))).toBe('400');
  });
});

function toStr(v: { toString(): string }): string {
  return v.toString();
}
