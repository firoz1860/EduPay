import type { Request } from 'express';
import type { JwtPayload } from './jwt';
import { UnauthorizedError } from './errors';

export type Actor = JwtPayload;

/**
 * A syntactically valid UUID that will never match a real record (record ids are
 * random uuidv4). Used to scope a STUDENT whose account has no linked student
 * record to an empty result set, instead of an invalid filter value that would
 * error at the database.
 */
export const UNMATCHABLE_UUID = '00000000-0000-0000-0000-000000000000';

/** Extracts the authenticated actor, guaranteeing presence (routes are guarded). */
export function getActor(req: Request): Actor {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
