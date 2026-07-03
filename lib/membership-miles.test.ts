import { describe, expect, it } from 'vitest';
import { calculateMonthlyMilesRollover, UNLIMITED_SERVICE_MILES } from './membership-miles';

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

  it('treats unlimited monthly grant as unlimited balance', () => {
    const out = calculateMonthlyMilesRollover({
      currentBalance: 10,
      rolloverCap: 40,
      monthlyGrant: UNLIMITED_SERVICE_MILES,
    });

    expect(out).toEqual({
      rolloverBank: UNLIMITED_SERVICE_MILES,
      expiredMiles: 0,
      newBalance: UNLIMITED_SERVICE_MILES,
    });
  });

  it('treats unlimited current balance as unlimited balance', () => {
    const out = calculateMonthlyMilesRollover({
      currentBalance: UNLIMITED_SERVICE_MILES,
      rolloverCap: 0,
      monthlyGrant: 0,
    });

    expect(out.newBalance).toBe(UNLIMITED_SERVICE_MILES);
    expect(out.expiredMiles).toBe(0);
  });
});
