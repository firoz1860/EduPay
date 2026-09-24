import 'dotenv/config';
import { z } from 'zod';

/**
 * Centralized, validated environment configuration.
 * The process fails fast on boot if required variables are missing/invalid,
 * so we never run with a half-configured server.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Open self-registration. Demo convenience — set to false in production and
  // create staff accounts via an admin instead.
  ALLOW_OPEN_REGISTRATION: z
    .string()
    .default('true')
    .transform((v) => v.toLowerCase() === 'true'),

  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_SUCCESS_URL: z.string().default('http://localhost:3000/payments'),
  STRIPE_CANCEL_URL: z.string().default('http://localhost:3000/payments'),

  AI_PROVIDER: z.enum(['mock', 'openai']).default('mock'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  process.stderr.write(
    `Invalid environment configuration:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}\n`,
  );
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Allowed CORS origins parsed from FRONTEND_URL (comma-separated). */
export const allowedOrigins = env.FRONTEND_URL.split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

/** Whether a real Stripe key is configured (otherwise payments run in simulated mode). */
export const stripeEnabled = env.STRIPE_SECRET_KEY.startsWith('sk_');
