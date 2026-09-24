import pino from 'pino';
import { isProd, isTest } from '../config/env';

/**
 * Structured logger. Redacts sensitive fields so secrets/tokens/passwords
 * never reach the logs.
 */
export const logger = pino({
  level: isTest ? 'silent' : isProd ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["idempotency-key"]',
      'req.headers["x-ai-key"]',
      'password',
      'passwordHash',
      '*.password',
      '*.passwordHash',
      'apiKey',
      '*.apiKey',
      'token',
      'accessToken',
      'refreshToken',
      'STRIPE_SECRET_KEY',
      'JWT_SECRET',
      'OPENAI_API_KEY',
    ],
    censor: '[REDACTED]',
  },
  transport:
    !isProd && !isTest
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
});
