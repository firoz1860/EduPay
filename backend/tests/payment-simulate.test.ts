import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Focused tests for the admin "Simulate Success/Failure" endpoint
 * (simulateSettlement). They pin the intended, security-relevant behavior:
 *
 *  1. When Stripe IS configured, simulation is REJECTED (ConflictError) and no
 *     settlement runs — real money must settle via the Stripe webhook, never a
 *     manual mark-as-paid.
 *  2. When Stripe is NOT configured (demo mode), success drives the real
 *     settlement path exactly once.
 *  3. Re-running the same outcome is idempotent (an already-processed gateway
 *     event is a no-op) — no duplicate settlement / ledger.
 */
const h = vi.hoisted(() => ({
  stripeEnabled: false,
  paymentFindUnique: vi.fn(),
  txn: vi.fn(),
  geFindUnique: vi.fn(),
  geCreate: vi.fn(),
  geUpdate: vi.fn(),
  settleSuccess: vi.fn(),
  settleFailure: vi.fn(),
  publishSettled: vi.fn(),
  publishCreated: vi.fn(),
}));

vi.mock('../src/config/stripe', () => ({
  get stripeEnabled() {
    return h.stripeEnabled;
  },
  stripe: null,
}));

vi.mock('../src/config/prisma', () => ({
  prisma: {
    payment: { findUnique: h.paymentFindUnique },
    $transaction: h.txn,
  },
}));

vi.mock('../src/modules/payments/payments.settlement', () => ({
  settlePaymentSuccess: h.settleSuccess,
  settlePaymentFailure: h.settleFailure,
}));

vi.mock('../src/realtime/publish', () => ({
  publishPaymentSettled: h.publishSettled,
  publishPaymentCreated: h.publishCreated,
}));

import { simulateSettlement } from '../src/modules/payments/payments.service';
import { ConflictError } from '../src/lib/errors';

const admin = { sub: 'a1', name: 'Admin', role: 'ADMIN', studentId: null } as never;

// A payment object that satisfies both the initial fetch and getPaymentById's serialize.
const paymentRow = {
  id: 'pay-1',
  studentId: 'stu-1',
  amount: 40000,
  paymentMethod: 'card',
  status: 'PENDING',
  invoice: null,
  attempts: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.stripeEnabled = false;
  h.paymentFindUnique.mockResolvedValue(paymentRow);
  h.geFindUnique.mockResolvedValue(null);
  h.geCreate.mockResolvedValue({});
  h.geUpdate.mockResolvedValue({});
  h.settleSuccess.mockResolvedValue(undefined);
  h.settleFailure.mockResolvedValue(undefined);
  h.publishSettled.mockResolvedValue(undefined);
  // $transaction runs its callback with a tx exposing the gatewayEvent model.
  h.txn.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({ gatewayEvent: { findUnique: h.geFindUnique, create: h.geCreate, update: h.geUpdate } }),
  );
});

describe('simulateSettlement', () => {
  it('is blocked when Stripe is configured (ConflictError, no settlement)', async () => {
    h.stripeEnabled = true;
    await expect(
      simulateSettlement('pay-1', { outcome: 'success' } as never, admin, 'req'),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(h.txn).not.toHaveBeenCalled();
    expect(h.settleSuccess).not.toHaveBeenCalled();
  });

  it('settles success exactly once via the settlement path when Stripe is off', async () => {
    await simulateSettlement('pay-1', { outcome: 'success' } as never, admin, 'req');
    expect(h.settleSuccess).toHaveBeenCalledTimes(1);
    expect(h.settleFailure).not.toHaveBeenCalled();
    // Settlement is driven with a SUCCESS gateway status, mirroring a real webhook.
    expect(h.settleSuccess.mock.calls[0][2].gatewayStatus).toBe('SUCCESS');
    // Gateway event is created then marked processed (idempotency ledger).
    expect(h.geCreate).toHaveBeenCalledTimes(1);
    expect(h.geUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processed: true }) }),
    );
    expect(h.publishSettled).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — an already-processed event does not settle again', async () => {
    h.geFindUnique.mockResolvedValue({ processed: true });
    await simulateSettlement('pay-1', { outcome: 'success' } as never, admin, 'req');
    expect(h.settleSuccess).not.toHaveBeenCalled();
    expect(h.geCreate).not.toHaveBeenCalled();
    expect(h.geUpdate).not.toHaveBeenCalled();
  });
});
