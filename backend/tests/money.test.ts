import { describe, it, expect } from 'vitest';
import { add, sub, round2, eq, gt, toNumber, ZERO } from '../src/lib/money';

describe('money', () => {
  it('adds without floating point drift (0.1 + 0.2 === 0.3)', () => {
    expect(add(0.1, 0.2).toString()).toBe('0.3');
  });

  it('rounds half-up to 2 dp', () => {
    expect(round2(1.005).toString()).toBe('1.01');
    expect(round2(2.344).toString()).toBe('2.34');
  });

  it('subtracts precisely', () => {
    expect(sub(78000, 5000).toString()).toBe('73000');
  });

  it('compares by 2dp value', () => {
    expect(eq(10, 10.004)).toBe(true);
    expect(gt(10.01, 10)).toBe(true);
  });

  it('serializes to number and handles null', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(ZERO)).toBe(0);
    expect(toNumber(round2(42.5))).toBe(42.5);
  });
});
