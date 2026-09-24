import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { allowedOrigins } from './config/env';
import { requestId } from './middleware/requestId.middleware';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';
import { asyncHandler } from './lib/asyncHandler';
import { stripeWebhookHandler } from './modules/payments/payments.webhook';
import v1Router from './routes/index';

export function createApp(): Express {
  const app = express();

  // Behind Render/Vercel proxies — needed for correct client IPs (rate limiting).
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser clients (no Origin) and configured origins only.
        if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    }),
  );
  app.use(compression());
  app.use(requestId);

  // Health check — no auth, no rate limit.
  const health = (_req: Request, res: Response) => res.status(200).json({ status: 'ok' });
  app.get('/health', health);
  app.get('/api/v1/health', health);

  // Stripe webhook MUST receive the raw body for signature verification, so it is
  // registered BEFORE the JSON body parser. Canonical path is
  // /api/v1/webhooks/stripe; /api/v1/payments/webhook is kept as a legacy alias.
  const stripeRawBody = express.raw({ type: 'application/json' });
  app.post('/api/v1/webhooks/stripe', stripeRawBody, asyncHandler(stripeWebhookHandler));
  app.post('/api/v1/payments/webhook', stripeRawBody, asyncHandler(stripeWebhookHandler));

  // Standard parsers for the rest of the API.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/api/v1', apiLimiter, v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
