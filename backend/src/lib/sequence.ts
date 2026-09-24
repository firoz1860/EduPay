import { randomBytes } from 'node:crypto';

/**
 * Generates a human-readable, collision-resistant reference number.
 * Format: PREFIX-YYYYMMDD-XXXXXX  (X = base32 crockford-ish).
 * Uniqueness is ultimately guaranteed by DB unique constraints; the random
 * suffix makes collisions astronomically unlikely under concurrency.
 */
export function generateNumber(prefix: string): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const suffix = randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  return `${prefix}-${y}${m}${d}-${suffix}`;
}
