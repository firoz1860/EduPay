import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const h = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  webhookSecrets: vi.fn<[], string[]>(() => ['whsec_test_dummy_secret']),
  gatewayFindUnique: vi.fn(),
  gatewayCreate: vi.fn(),
  gatewayUpdate: vi.fn(),
  auditCreate: vi.fn(),
  settleSuccess: vi.fn(),
  settleFailure: vi.fn(),
  publishSettled: vi.fn(),
}));

vi.mock('../src/config/stripe', () => ({
  stripe: { paymentIntents: {} },
  stripeEnabled: true,
  stripeWebhooks: { webhooks: { constructEvent: h.constructEvent } },
  webhookSecrets: h.webhookSecrets,
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
  h.webhookSecrets.mockReturnValue(['whsec_test_dummy_secret']);
  h.gatewayFindUnique.mockResolvedValue(null);
  h.gatewayCreate.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111' });
  h.gatewayUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.settleSuccess.mockResolvedValue(undefined);
  h.publishSettled.mockResolvedValue(undefined);
});

describe('POST /api/v1/webhooks/stripe', () => {
  it('is registered (not 404) at the canonical path', async () => {
    h.constructEvent.mockReturnValue(succeededEvent());
    const res = await request(app).post(PATH).set('stripe-signature', 't=1,v1=x').send('{}');
    expect(res.status).not.toBe(404);
  });

  it('is reachable at the legacy alias /api/v1/payments/webhook', async () => {
    h.constructEvent.mockReturnValue(succeededEvent());
    const res = await request(app).post('/api/v1/payments/webhook').set('stripe-signature', 't=1,v1=x').send('{}');
    expect(res.status).toBe(200);
  });

  it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    h.webhookSecrets.mockReturnValue([]);
    const res = await request(app).post(PATH).set('stripe-signature', 't=1,v1=x').send('{}');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('STRIPE_WEBHOOK_NOT_CONFIGURED');
  });

  it('rejects a missing Stripe signature with 400', async () => {
    const res = await request(app).post(PATH).send('{}');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_MISSING');
  });

  it('rejects an invalid Stripe signature with 400', async () => {
    h.constructEvent.mockImplementation(() => {
      throw new Error('signature verification failed');
    });
    const res = await request(app).post(PATH).set('stripe-signature', 't=1,v1=bad').send('{}');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('accepts a valid payment_intent.succeeded, verifies against the raw Buffer + env secret, returns 200', async () => {
    h.constructEvent.mockReturnValue(succeededEvent('pay_123'));
    const res = await request(app)
      .post(PATH)
      .set('stripe-signature', 't=1,v1=good')
      .set('content-type', 'application/json; charset=utf-8')
      .send('{}');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true });
    const firstArg = h.constructEvent.mock.calls[0][0];
    expect(Buffer.isBuffer(firstArg)).toBe(true);
    expect(h.constructEvent.mock.calls[0][2]).toBe('whsec_test_dummy_secret');
    expect(h.settleSuccess).toHaveBeenCalledTimes(1);
    expect(h.publishSettled).toHaveBeenCalledWith('pay_123');
  });

  it('tries multiple configured secrets until one verifies', async () => {
    h.webhookSecrets.mockReturnValue(['whsec_wrong', 'whsec_right']);
    h.constructEvent
      .mockImplementationOnce(() => {
        throw new Error('no match');
      })
      .mockReturnValueOnce(succeededEvent());
    const res = await request(app).post(PATH).set('stripe-signature', 't=1,v1=x').send('{}');
    expect(res.status).toBe(200);
    expect(h.constructEvent).toHaveBeenCalledTimes(2);
  });

  it('is idempotent: a duplicate event is not processed twice', async () => {
    h.constructEvent.mockReturnValue(succeededEvent('pay_123'));
    h.gatewayFindUnique.mockResolvedValue({ id: '22222222-2222-2222-2222-222222222222', processed: true });
    const res = await request(app).post(PATH).set('stripe-signature', 't=1,v1=good').send('{}');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, duplicate: true });
    expect(h.settleSuccess).not.toHaveBeenCalled();
    expect(h.gatewayCreate).not.toHaveBeenCalled();
  });

  it('safely acknowledges an unknown but valid event with 200 (no settlement)', async () => {
    h.constructEvent.mockReturnValue({ id: 'evt_unknown_1', type: 'customer.created', data: { object: { metadata: {} } } });
    const res = await request(app).post(PATH).set('stripe-signature', 't=1,v1=good').send('{}');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true });
    expect(h.settleSuccess).not.toHaveBeenCalled();
  });
});
