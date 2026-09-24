import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../lib/jwt';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';

/**
 * Route-level RBAC guard. Server-side enforcement — the definitive
 * authorization boundary (the frontend's role checks are UX only).
 *
 * Usage: router.post('/', authenticate, requireRole('ADMIN', 'ACCOUNTANT'), handler)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Requires one of roles: ${roles.join(', ')}. Your role: ${req.user.role}`,
      );
    }
    next();
  };
}

/** Convenience: any authenticated staff role (everyone except STUDENT). */
export const requireStaff = requireRole('ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'AUDITOR');
