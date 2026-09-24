import type { Request } from 'express';
import type { JwtPayload } from './jwt';
import { UnauthorizedError } from './errors';

export type Actor = JwtPayload;

/** Extracts the authenticated actor, guaranteeing presence (routes are guarded). */
export function getActor(req: Request): Actor {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
