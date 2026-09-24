import { describe, it, expect } from 'vitest';
import { canTransition, assertTransition, isTerminal } from '../src/services/payment-state';

describe('payment state machine', () => {
  it('allows the happy path CREATED -> PENDING -> SUCCESS', () => {
    expect(canTransition('CREATED', 'PENDING')).toBe(true);
    expect(canTransition('PENDING', 'SUCCESS')).toBe(true);
  });

  it('allows SUCCESS -> REFUND_PENDING -> REFUNDED', () => {
    expect(canTransition('SUCCESS', 'REFUND_PENDING')).toBe(true);
    expect(canTransition('REFUND_PENDING', 'REFUNDED')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('FAILED', 'SUCCESS')).toBe(false);
    expect(canTransition('REFUNDED', 'SUCCESS')).toBe(false);
    expect(canTransition('CANCELLED', 'PENDING')).toBe(false);
  });

  it('treats same-state as an allowed idempotent no-op', () => {
    expect(canTransition('SUCCESS', 'SUCCESS')).toBe(true);
  });

  it('assertTransition throws a 409 on illegal move', () => {
    expect(() => assertTransition('FAILED', 'SUCCESS')).toThrowError(/Illegal payment transition/);
  });

  it('identifies terminal states', () => {
    expect(isTerminal('REFUNDED')).toBe(true);
    expect(isTerminal('SUCCESS')).toBe(false);
  });
});
