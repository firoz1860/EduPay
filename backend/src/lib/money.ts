import { Prisma } from '@prisma/client';

/**
 * Money helpers built on Prisma.Decimal (backed by decimal.js) so monetary
 * math never touches IEEE-754 floats. All financial amounts in EduPay are
 * stored and computed as Decimal(12,2).
 */
export type Money = Prisma.Decimal;
export const Decimal = Prisma.Decimal;

export const ZERO = new Prisma.Decimal(0);

export function money(value: Prisma.Decimal.Value): Money {
  return new Prisma.Decimal(value);
}

/** Round to 2 decimal places (half-up) — the canonical currency precision. */
export function round2(value: Prisma.Decimal.Value): Money {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function add(...values: Prisma.Decimal.Value[]): Money {
  return round2(values.reduce<Money>((acc, v) => acc.add(v), ZERO));
}

export function sub(a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): Money {
  return round2(new Prisma.Decimal(a).sub(b));
}

export function isNegative(value: Prisma.Decimal.Value): boolean {
  return new Prisma.Decimal(value).lessThan(0);
}

export function eq(a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): boolean {
  return round2(a).equals(round2(b));
}

export function gt(a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): boolean {
  return round2(a).greaterThan(round2(b));
}

export function gte(a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): boolean {
  return round2(a).greaterThanOrEqualTo(round2(b));
}

export function lt(a: Prisma.Decimal.Value, b: Prisma.Decimal.Value): boolean {
  return round2(a).lessThan(round2(b));
}

/** Serialize a Decimal to a number for JSON responses (safe within Decimal(12,2)). */
export function toNumber(value: Prisma.Decimal.Value | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return new Prisma.Decimal(value).toNumber();
}
