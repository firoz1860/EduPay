import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { logger } from './lib/logger';
import { initSocket, closeSocket } from './realtime/socket';

async function main(): Promise<void> {
  // Boot-time hint: if Stripe is enabled but the webhook secret is absent or a
  // placeholder, webhooks will fail signature verification (HTTP 400). Never logs
  // the value itself.
  if (
    env.STRIPE_SECRET_KEY.startsWith('sk_') &&
    (!env.STRIPE_WEBHOOK_SECRET || /x{3,}|changeme|placeholder/i.test(env.STRIPE_WEBHOOK_SECRET))
  ) {
    logger.warn(
      'STRIPE_WEBHOOK_SECRET is missing or a placeholder — Stripe webhooks will return 400. Set it to the whsec_… printed by `stripe listen` (for CLI tests) or your Dashboard endpoint signing secret.',
    );
  }

  const app = createApp();
  const server = http.createServer(app);

  // Attach the real-time (Socket.IO) transport to the same HTTP server.
  initSocket(server);

  // Bind to 0.0.0.0 so the server is reachable inside containers / on Render.
  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`EduPay API + realtime listening on http://0.0.0.0:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    await closeSocket();
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
