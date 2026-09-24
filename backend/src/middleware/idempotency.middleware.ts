import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { IdempotencyConflictError, ConflictError, UnprocessableError } from '../lib/errors';
import { logger } from '../lib/logger';

/** Stable JSON stringify (sorted keys) so payload hashing is order-independent. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function hashBody(body: unknown): string {
  return createHash('sha256').update(stableStringify(body ?? {})).digest('hex');
}

interface Options {
  /** When true, a missing Idempotency-Key header is rejected (422). */
  required?: boolean;
}

/**
 * Idempotency middleware for mutating, money-moving operations.
 *
 * - Same key + same payload, completed  -> replay the stored response.
 * - Same key + same payload, in-flight  -> 409 (still processing).
 * - Same key + different payload        -> 409 IDEMPOTENCY_KEY_CONFLICT.
 * - New key                             -> process, then persist the response
 *                                          on `finish` for future replays.
 */
export function idempotency(operation: string, options: Options = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('idempotency-key')?.trim();

    if (!key) {
      if (options.required) {
        throw new UnprocessableError('Missing required Idempotency-Key header');
      }
      return next();
    }

    const requestHash = hashBody(req.body);
    req.idempotency = { key, operation };

    const existing = await prisma.idempotencyKey.findUnique({ where: { key } });

    if (existing) {
      const stored = (existing.requestBody as { hash?: string } | null) ?? {};
      if (existing.operation !== operation || stored.hash !== requestHash) {
        throw new IdempotencyConflictError();
      }
      if (existing.responseBody === null || existing.statusCode === 0) {
        throw new ConflictError('A request with this Idempotency-Key is still being processed');
      }
      logger.info({ key, operation, requestId: req.requestId }, 'Idempotent replay');
      res.setHeader('idempotent-replay', 'true');
      res.status(existing.statusCode).json(existing.responseBody);
      return;
    }

    // Reserve the key (pending). Concurrent inserts collide on the unique key.
    try {
      await prisma.idempotencyKey.create({
        data: {
          key,
          operation,
          requestBody: { hash: requestHash, body: req.body ?? {} } as Prisma.InputJsonValue,
          responseBody: Prisma.DbNull,
          statusCode: 0,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('A request with this Idempotency-Key is still being processed');
      }
      throw err;
    }

    // Capture the response body and persist it once the response is flushed.
    let captured: unknown;
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      captured = body;
      return originalJson(body);
    };

    res.on('finish', () => {
      if (captured === undefined || res.statusCode >= 500) {
        // Failed to produce a replayable result — release the reservation.
        prisma.idempotencyKey
          .delete({ where: { key } })
          .catch(() => undefined);
        return;
      }
      prisma.idempotencyKey
        .update({
          where: { key },
          data: {
            responseBody: captured as Prisma.InputJsonValue,
            statusCode: res.statusCode,
          },
        })
        .catch((e) => logger.error({ e, key }, 'Failed to persist idempotent response'));
    });

    next();
  };
}
