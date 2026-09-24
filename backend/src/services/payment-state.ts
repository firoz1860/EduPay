import { ConflictError } from '../lib/errors';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

/** Allowed payment state transitions. Anything not listed is rejected. */
const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  CREATED: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
  PENDING: ['SUCCESS', 'FAILED', 'CANCELLED'],
  SUCCESS: ['REFUND_PENDING', 'REFUNDED'],
  FAILED: [],
  CANCELLED: [],
  REFUND_PENDING: ['REFUNDED', 'SUCCESS'],
  REFUNDED: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true; // idempotent no-op transitions are allowed
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throws a 409 if the transition is not permitted by the state machine. */
export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(`Illegal payment transition ${from} -> ${to}`);
  }
}

export const TERMINAL_STATES: PaymentStatus[] = ['FAILED', 'CANCELLED', 'REFUNDED'];

export function isTerminal(status: PaymentStatus): boolean {
  return TERMINAL_STATES.includes(status);
}
