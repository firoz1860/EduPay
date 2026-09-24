import { PrismaClient, Prisma } from '@prisma/client';
import { isProd } from './env';

/**
 * Single shared PrismaClient instance (connection pooling / reuse).
 * In dev we cache on globalThis to survive hot reloads without leaking
 * connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!isProd) globalForPrisma.prisma = prisma;

/** Re-export the transaction client type for service signatures. */
export type Tx = Prisma.TransactionClient;
