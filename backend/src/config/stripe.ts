import Stripe from 'stripe';
import { env, stripeEnabled } from './env';

export const stripe: Stripe | null = stripeEnabled ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export const stripeWebhooks: Stripe = new Stripe(
  env.STRIPE_SECRET_KEY || 'stripe_webhook_signature_verifier',
);

export function webhookSecrets(): string[] {
  return env.STRIPE_WEBHOOK_SECRET.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export { stripeEnabled };
