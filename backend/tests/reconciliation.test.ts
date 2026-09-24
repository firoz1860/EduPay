import { describe, it, expect } from 'vitest';
import { classifyReconciliation, normalizeStatus } from '../src/services/reconciliation-classifier';

describe('normalizeStatus', () => {
  it('maps provider vocabularies to canonical set', () => {
    expect(normalizeStatus('succeeded')).toBe('SUCCESS');
    expect(normalizeStatus('paid')).toBe('SUCCESS');
    expect(normalizeStatus('declined')).toBe('FAILED');
    expect(normalizeStatus('processing')).toBe('PENDING');
    expect(normalizeStatus(null)).toBe('UNKNOWN');
  });
});

describe('classifyReconciliation', () => {
  const side = (reference: string, amount: number, status: string) => ({ reference, amount, status });

  it('MATCHED when amount and status agree', () => {
    const r = classifyReconciliation(side('PAY123', 20000, 'SUCCESS'), side('PAY123', 20000, 'succeeded'));
    expect(r.status).toBe('MATCHED');
  });

  it('AMOUNT_MISMATCH when amounts differ', () => {
    const r = classifyReconciliation(side('PAY123', 20000, 'SUCCESS'), side('PAY123', 19000, 'succeeded'));
    expect(r.status).toBe('AMOUNT_MISMATCH');
  });

  it('STATE_MISMATCH when internal PENDING but gateway SUCCESS', () => {
    const r = classifyReconciliation(side('PAY123', 20000, 'PENDING'), side('PAY123', 20000, 'succeeded'));
    expect(r.status).toBe('STATE_MISMATCH');
  });

  it('MISSING_GATEWAY when only internal exists', () => {
    const r = classifyReconciliation(side('PAY123', 20000, 'SUCCESS'), null);
    expect(r.status).toBe('MISSING_GATEWAY');
  });

  it('MISSING_INTERNAL when only gateway exists', () => {
    const r = classifyReconciliation(null, side('PAY123', 20000, 'succeeded'));
    expect(r.status).toBe('MISSING_INTERNAL');
  });

  it('DUPLICATE when flagged', () => {
    const r = classifyReconciliation(side('PAY123', 20000, 'SUCCESS'), side('PAY123', 20000, 'succeeded'), { duplicate: true });
    expect(r.status).toBe('DUPLICATE');
  });

  it('amount mismatch takes precedence over state mismatch', () => {
    const r = classifyReconciliation(side('PAY123', 20000, 'PENDING'), side('PAY123', 19000, 'succeeded'));
    expect(r.status).toBe('AMOUNT_MISMATCH');
  });
});
