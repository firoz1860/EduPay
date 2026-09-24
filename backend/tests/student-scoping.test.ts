import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression tests: a STUDENT whose account has no linked student record
 * (actor.studentId === null) must get a normal empty 200 result from the
 * student-scoped list endpoints — never a database UUID error, and never any
 * other student's records.
 */
const h = vi.hoisted(() => ({
  invoiceFind: vi.fn(), invoiceCount: vi.fn(),
  paymentFind: vi.fn(), paymentCount: vi.fn(),
  studentFind: vi.fn(), studentCount: vi.fn(),
  ledgerFind: vi.fn(), ledgerCount: vi.fn(),
  refundFind: vi.fn(), refundCount: vi.fn(),
  instFind: vi.fn(), instCount: vi.fn(),
}));

vi.mock('../src/config/prisma', () => ({
  prisma: {
    invoice: { findMany: h.invoiceFind, count: h.invoiceCount },
    payment: { findMany: h.paymentFind, count: h.paymentCount },
    student: { findMany: h.studentFind, count: h.studentCount },
    ledgerEntry: { findMany: h.ledgerFind, count: h.ledgerCount },
    refund: { findMany: h.refundFind, count: h.refundCount },
    installment: { findMany: h.instFind, count: h.instCount },
  },
}));

import { UNMATCHABLE_UUID } from '../src/lib/actor';
import { listInvoices } from '../src/modules/invoices/invoices.service';
import { listPayments } from '../src/modules/payments/payments.service';
import { listStudents } from '../src/modules/students/students.service';
import { listLedgerEntries } from '../src/modules/ledger/ledger.service';
import { listRefunds } from '../src/modules/refunds/refunds.service';
import { listInstallments } from '../src/modules/installments/installments.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const query = { page: 1, pageSize: 20, sortOrder: 'desc' } as never;
const studentNoLink = { sub: 'u1', email: 's@e.com', role: 'STUDENT', name: 'S', studentId: null } as never;
const studentLinked = { sub: 'u1', email: 's@e.com', role: 'STUDENT', name: 'S', studentId: '11111111-1111-1111-1111-111111111111' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  for (const f of [h.invoiceFind, h.paymentFind, h.studentFind, h.ledgerFind, h.refundFind, h.instFind]) f.mockResolvedValue([]);
  for (const c of [h.invoiceCount, h.paymentCount, h.studentCount, h.ledgerCount, h.refundCount, h.instCount]) c.mockResolvedValue(0);
});

const whereOf = (fn: ReturnType<typeof vi.fn>) => (fn.mock.calls[0][0] as { where: Record<string, unknown> }).where;

describe('STUDENT with no linked student record -> empty 200, valid scoping', () => {
  it('invoices: empty result, scoped by a valid non-matching UUID (not __none__)', async () => {
    const res = await listInvoices(query, studentNoLink);
    expect(res.data).toEqual([]);
    expect(res.meta.total).toBe(0);
    const where = whereOf(h.invoiceFind);
    expect(where.studentId).toBe(UNMATCHABLE_UUID);
    expect(String(where.studentId)).toMatch(UUID_RE);
    expect(where.studentId).not.toBe('__none__');
  });

  it('payments: empty result, scoped by a valid non-matching UUID', async () => {
    const res = await listPayments(query, studentNoLink);
    expect(res.data).toEqual([]);
    expect(res.meta.total).toBe(0);
    expect(whereOf(h.paymentFind).studentId).toBe(UNMATCHABLE_UUID);
    expect(String(whereOf(h.paymentFind).studentId)).toMatch(UUID_RE);
  });

  it('students: empty result, scoped by a valid non-matching UUID on id', async () => {
    const res = await listStudents(query, studentNoLink);
    expect(res.data).toEqual([]);
    expect(res.meta.total).toBe(0);
    expect(whereOf(h.studentFind).id).toBe(UNMATCHABLE_UUID);
    expect(String(whereOf(h.studentFind).id)).toMatch(UUID_RE);
  });

  it('ledger: empty result, scoped by a valid non-matching UUID', async () => {
    const res = await listLedgerEntries(query, studentNoLink);
    expect(res.data).toEqual([]);
    expect(res.meta.total).toBe(0);
    expect(whereOf(h.ledgerFind).studentId).toBe(UNMATCHABLE_UUID);
  });

  it('refunds: empty result, scoped by a valid non-matching UUID', async () => {
    const res = await listRefunds(query, studentNoLink);
    expect(res.data).toEqual([]);
    expect(res.meta.total).toBe(0);
    expect(whereOf(h.refundFind).studentId).toBe(UNMATCHABLE_UUID);
  });

  it('installments: empty result, scoped via invoice.studentId non-matching UUID', async () => {
    const res = await listInstallments(query, studentNoLink);
    expect(res.data).toEqual([]);
    expect(res.meta.total).toBe(0);
    const inv = (whereOf(h.instFind).invoice as { studentId: string }).studentId;
    expect(inv).toBe(UNMATCHABLE_UUID);
    expect(inv).toMatch(UUID_RE);
  });
});

describe('STUDENT WITH a linked student record -> existing behavior unchanged', () => {
  it('invoices scope by the real studentId, not the sentinel', async () => {
    await listInvoices(query, studentLinked);
    expect(whereOf(h.invoiceFind).studentId).toBe('11111111-1111-1111-1111-111111111111');
  });
  it('students scope by the real id', async () => {
    await listStudents(query, studentLinked);
    expect(whereOf(h.studentFind).id).toBe('11111111-1111-1111-1111-111111111111');
  });
  it('payments scope by the real studentId', async () => {
    await listPayments(query, studentLinked);
    expect(whereOf(h.paymentFind).studentId).toBe('11111111-1111-1111-1111-111111111111');
  });
});
