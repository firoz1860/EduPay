import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { isProd } from '../config/env';
import { logger } from '../lib/logger';

/** 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      details: [],
    },
    requestId: req.requestId,
  });
}

/**
 * Centralized error middleware. Maps AppError, ZodError and known Prisma
 * errors to the standard error envelope. Never leaks stack traces in prod.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      code = 'CONFLICT';
      const target = (err.meta?.target as string[] | undefined)?.join(', ');
      message = target ? `A record with this ${target} already exists` : 'Duplicate value';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      code = 'NOT_FOUND';
      message = 'Related record not found';
    } else if (err.code === 'P2003') {
      statusCode = 409;
      code = 'FK_CONSTRAINT';
      message = 'Operation violates a foreign-key constraint';
    } else {
      statusCode = 400;
      code = 'DATABASE_ERROR';
      message = 'A database error occurred';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    code = 'DATABASE_VALIDATION_ERROR';
    message = 'Invalid database query';
  }

  if (statusCode >= 500) {
    logger.error({ err, requestId: req.requestId, path: req.originalUrl }, 'Unhandled error');
  } else {
    logger.warn({ code, requestId: req.requestId, path: req.originalUrl, message }, 'Handled error');
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: details ?? [],
      ...(isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
    },
    requestId: req.requestId,
  });
}
