import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/**
 * Integration tests for the Stripe webhook route.
 * Stripe, Prisma, settlement and realtime publishing are mocked so the test runs
 * with no database/network — it exercises routing, raw-body signature handling,
 * idempotency (duplicate events) and the success path.
 */

const h = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  gatewayFindUnique: vi.fn(),
  gatewayCreate: vi.fn(),
  gatewayUpdate: vi.fn(),
  auditCreate: vi.fn(),
  settleSuccess: vi.fn(),
  settleFailure: vi.fn(),
  publishSettled: vi.fn(),
}));

vi.mock('../src/config/stripe', () => ({
  stripe: { webhooks: { constructEvent: h.constructEvent } },
  stripeEnabled: true,
}));

vi.mock('../src/config/prisma', () => {
  const tx = {
    gatewayEvent: { create: h.gatewayCreate, update: h.gatewayUpdate },
    auditLog: { create: h.auditCreate },
  };
  return {
    prisma: {
      gatewayEvent: { findUnique: h.gatewayFindUnique },
      auditLog: { create: h.auditCreate },
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    },
  };
});

vi.mock('../src/modules/payments/payments.settlement', () => ({
  settlePaymentSuccess: h.settleSuccess,
  settlePaymentFailure: h.settleFailure,
  upsertReconciliation: vi.fn(),
}));

vi.mock('../src/realtime/publish', () => ({
  publishPaymentSettled: h.publishSettled,
  publishPaymentCreated: vi.fn(),
  publishRefundCompleted: vi.fn(),
  publishReconciliationRun: vi.fn(),
  publishReconciliationResolved: vi.fn(),
  publishInvoiceCreated: vi.fn(),
}));

// Import AFTER mocks are registered.
import { createApp } from '../src/app';

const app = createApp();
const PATH = '/api/v1/webhooks/stripe';

function succeededEvent(paymentId?: string) {
  return {
    id: 'evt_test_1',
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_test_1', amount_received: 100000, metadata: paymentId ? { paymentId } : {} } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.gatewayFindUnique.mockResolvedValue(null);
  h.gatewayCreate.mockResolvedValue({});
  h.gatewayUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.settleSuccess.mockResolvedValue(undefined);
  h.publishSettled.mockResolvedValue(undefined);
});

describe('POST /api/v1/webhooks/stripe', () => {
  it('is registered (not 404) at the canonical path', async () => {
    h.constructEvent.mockReturnValue(succeededEvent());
    const res = await request(app).post(PATH).set('stripe-signature', 't=1,v1=x').set('content-type', 'application/json').send('{}');
    expect(res.status).not.toBe(404);
  });

  it('is also reachable at the legacy alias /api/v1/payments/webhook', async () => {
    h.constructEvent.mockReturnValue(succeededEvent());
    const res = await request(app).post('/api/v1/payments/webhook').set('stripe-signature', 't=1,v1=x').set('content-type', 'application/json').send('{}');
    expect(res.status).toBe(200);
  });

  it('rejects a missing Stripe signature with 400', async () => {
    const res = await request(app).post(PATH).set('content-type', 'application/json').send('{}');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_MISSING');
  });

  it('rejects an invalid Stripe signature with 400', async () => {
    h.constructEvent.mockImplementation(() => {
      throw new Error('signature verification failed');
    });
    const res = await request(app).post(PATH).set('stripe-signature', 't=1,v1=bad').set('content-type', 'application/json').send('{}');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('accepts a valid payment_intent.succeeded and returns 2xx', async () => {
    h.constructEvent.mockReturnValue(succeededEvent('pay_123'));
    const res = await request(app).post(PATH).set('stripe-signature', 't=1,v1=good').set('content-type', 'application/json').send('{}');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true });
    // The handler MUST receive the raw request body as a Buffer (express.raw),
    // i.e. express.json() did not consume/parse it before signature verification.
    const firstArg = h.constructEvent.mock.calls[0][0];
    expect(Buffer.isBuffer(firstArg)).toBe(true);
    // constructEvent is called with the signature + the env secret (not hardcoded).
    expect(h.constructEvent.mock.calls[0][2]).toBe('whsec_test_dummy_secret');
    // Settlement ran for the referenced payment (backend-controlled, not frontend-trusted).
    expect(h.settleSuccess).toHaveBeenCalledTimes(1);
    expect(h.publishSettled).toHaveBeenCalledWith('pay_123');
  });

  it('is idempotent: a duplicate event is not processed twice', async () => {
    h.constructEvent.mockReturnValue(succeededEvent('pay_123'));
    h.gatewayFindUnique.mockResolvedValue({ id: 'ge_1', processed: true });
    const res = await request(app).post(PATH).set('stripe-signature', 't=1,v1=good').set('content-type', 'application/json').send('{}');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, duplicate: true });
    // No settlement + no new gateway event when the event was already processed.
    expect(h.settleSuccess).not.toHaveBeenCalled();
    expect(h.gatewayCreate).not.toHaveBeenCalled();
  });
});
