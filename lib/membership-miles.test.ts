import { describe, expect, it } from 'vitest';
import { calculateMonthlyMilesRollover } from './membership-miles';

describe('calculateMonthlyMilesRollover', () => {
  it('rolls over up to cap and expires the rest', () => {
    const out = calculateMonthlyMilesRollover({
      currentBalance: 120,
      rolloverCap: 40,
      monthlyGrant: 60,
    });

    expect(out.rolloverBank).toBe(40);
    expect(out.expiredMiles).toBe(80);
    expect(out.newBalance).toBe(100);
  });

  it('does not expire when balance is under cap', () => {
    const out = calculateMonthlyMilesRollover({
      currentBalance: 25,
      rolloverCap: 40,
      monthlyGrant: 60,
    });

    expect(out.rolloverBank).toBe(25);
    expect(out.expiredMiles).toBe(0);
    expect(out.newBalance).toBe(85);
  });
});
