import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { stripe } from '../../config/stripe';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { recordAudit } from '../../services/audit.service';
import { settlePaymentSuccess, settlePaymentFailure } from './payments.settlement';
import { publishPaymentSettled } from '../../realtime/publish';

/**
 * Stripe webhook receiver.
 *
 * - Verifies the Stripe signature against the RAW request body.
 * - Is idempotent: the gateway event id is stored with a UNIQUE constraint, so a
 *   replayed event is detected and NOT processed twice (no duplicate settlement).
 * - Runs settlement inside a DB transaction.
 * - Never depends on the frontend; returns 200 quickly so Stripe stops retrying.
 */
export async function stripeWebhookHandler(req: Request, res: Response): Promise<Response> {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    logger.warn('Received webhook but Stripe is not configured');
    return res.status(200).json({ received: true, note: 'stripe-not-configured' });
  }

  const signature = req.header('stripe-signature');
  if (!signature) {
    return res.status(400).json({
      success: false,
      error: { code: 'WEBHOOK_SIGNATURE_MISSING', message: 'Missing stripe-signature header', details: [] },
    });
  }

  let event: Stripe.Event;
  try {
    // req.body is a Buffer here because the route uses express.raw().
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, 'Invalid Stripe webhook signature');
    return res.status(400).json({
      success: false,
      error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: 'Signature verification failed', details: [] },
    });
  }

  const paymentId = extractPaymentId(event);

  // Idempotency gate: reserve the event id. A duplicate delivery collides here.
  const alreadyProcessed = await prisma.gatewayEvent.findUnique({
    where: { gatewayEventId: event.id },
  });
  if (alreadyProcessed) {
    logger.info({ eventId: event.id }, 'Duplicate webhook — skipping');
    await recordAudit(prisma, {
      action: 'WEBHOOK_DUPLICATE',
      entity: 'GatewayEvent',
      entityId: alreadyProcessed.id,
      reason: `Duplicate delivery of ${event.type}`,
      requestId: req.requestId,
    });
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.gatewayEvent.create({
        data: {
          gatewayEventId: event.id,
          provider: 'STRIPE',
          eventType: event.type,
          eventData: event.data.object as unknown as Prisma.InputJsonValue,
          paymentId: paymentId ?? null,
          processed: false,
        },
      });

      await recordAudit(tx, {
        action: 'WEBHOOK_RECEIVED',
        entity: 'GatewayEvent',
        entityId: event.id,
        reason: event.type,
        requestId: req.requestId,
      });

      if (paymentId) {
        if (event.type === 'payment_intent.succeeded' || event.type === 'charge.succeeded') {
          const intent = event.data.object as Stripe.PaymentIntent;
          await settlePaymentSuccess(
            tx,
            paymentId,
            {
              providerPaymentId: intent.id,
              amount: (intent.amount_received ?? intent.amount) / 100,
              gatewayEventId: event.id,
              gatewayStatus: 'SUCCESS',
            },
            { requestId: req.requestId },
          );
        } else if (
          event.type === 'payment_intent.payment_failed' ||
          event.type === 'charge.failed'
        ) {
          const intent = event.data.object as Stripe.PaymentIntent;
          await settlePaymentFailure(
            tx,
            paymentId,
            intent.last_payment_error?.message ?? 'Payment failed at gateway',
            { requestId: req.requestId },
          );
        }
      }

      await tx.gatewayEvent.update({
        where: { gatewayEventId: event.id },
        data: { processed: true, processedAt: new Date() },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Concurrent duplicate delivery raced us — safe to acknowledge.
      logger.info({ eventId: event.id }, 'Concurrent duplicate webhook');
      return res.status(200).json({ received: true, duplicate: true });
    }
    logger.error({ err, eventId: event.id }, 'Webhook processing failed');
    // Return 500 so Stripe retries a genuinely failed (non-duplicate) event.
    return res.status(500).json({ received: false });
  }

  // Push the settlement to connected clients in real time (post-commit).
  if (paymentId) await publishPaymentSettled(paymentId);

  return res.status(200).json({ received: true });
}

function extractPaymentId(event: Stripe.Event): string | null {
  const obj = event.data.object as { metadata?: Record<string, string> };
  return obj.metadata?.paymentId ?? null;
}
