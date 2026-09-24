import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { UnauthorizedError } from '../lib/errors';

/**
 * Authenticates the request from the `Authorization: Bearer <token>` header.
 * Populates req.user. This is the server-side source of truth for identity —
 * the frontend is never trusted for authentication.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new UnauthorizedError('Missing bearer token');

  req.user = verifyAccessToken(token);
  next();
}
