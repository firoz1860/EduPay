import type { JwtPayload } from '../lib/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id attached by requestId middleware. */
      requestId: string;
      /** Authenticated user (set by auth middleware on protected routes). */
      user?: JwtPayload;
      /** Idempotency context (set by idempotency middleware when a key is present). */
      idempotency?: {
        key: string;
        operation: string;
      };
    }
  }
}

export {};
