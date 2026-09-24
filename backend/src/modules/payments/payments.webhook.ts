import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { stripeWebhooks, webhookSecrets } from '../../config/stripe';
import { logger } from '../../lib/logger';
import { recordAudit } from '../../services/audit.service';
import { settlePaymentSuccess, settlePaymentFailure } from './payments.settlement';
import { publishPaymentSettled } from '../../realtime/publish';

function verifySignature(rawBody: Buffer, signature: string, secrets: string[]): Stripe.Event | null {
  for (const secret of secrets) {
    try {
      return stripeWebhooks.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      continue;
    }
  }
  return null;
}

function extractPaymentId(event: Stripe.Event): string | null {
  const obj = event.data.object as { metadata?: Record<string, string> };
  return obj.metadata?.paymentId ?? null;
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<Response> {
  const secrets = webhookSecrets();
  if (secrets.length === 0) {
    logger.error('STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(500).json({
      success: false,
      error: {
        code: 'STRIPE_WEBHOOK_NOT_CONFIGURED',
        message: 'Webhook secret is not configured on the server',
        details: [],
      },
    });
  }

  const signature = req.header('stripe-signature');
  if (!signature) {
    return res.status(400).json({
      success: false,
      error: { code: 'WEBHOOK_SIGNATURE_MISSING', message: 'Missing stripe-signature header', details: [] },
    });
  }

  const event = verifySignature(req.body as Buffer, signature, secrets);
  if (!event) {
    logger.warn(
      {
        secretConfigured: true,
        secretCount: secrets.length,
        rawBodyIsBuffer: Buffer.isBuffer(req.body),
        rawBodyLength: Buffer.isBuffer(req.body) ? (req.body as Buffer).length : undefined,
      },
      'Stripe webhook signature verification failed',
    );
    return res.status(400).json({
      success: false,
      error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: 'Signature verification failed', details: [] },
    });
  }

  const paymentId = extractPaymentId(event);

  const alreadyProcessed = await prisma.gatewayEvent.findUnique({ where: { gatewayEventId: event.id } });
  if (alreadyProcessed) {
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
      const gatewayEvent = await tx.gatewayEvent.create({
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
        entityId: gatewayEvent.id,
        newValue: { stripeEventId: event.id, type: event.type },
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
        } else if (event.type === 'payment_intent.payment_failed' || event.type === 'charge.failed') {
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
      return res.status(200).json({ received: true, duplicate: true });
    }
    logger.error({ eventId: event.id, eventType: event.type }, 'Webhook processing failed');
    return res.status(500).json({
      success: false,
      error: { code: 'WEBHOOK_PROCESSING_ERROR', message: 'Failed to process webhook', details: [] },
    });
  }

  if (paymentId) await publishPaymentSettled(paymentId);

  return res.status(200).json({ received: true });
}
