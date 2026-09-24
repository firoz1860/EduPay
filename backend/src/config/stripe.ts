import Stripe from 'stripe';
import { env, stripeEnabled } from './env';

/**
 * Stripe client (test mode). When no real key is configured the app still
 * boots and payments fall back to a deterministic simulated gateway so the
 * product remains fully demonstrable without secrets.
 */
export const stripe: Stripe | null = stripeEnabled
  ? new Stripe(env.STRIPE_SECRET_KEY, { typescript: true })
  : null;

export { stripeEnabled };
