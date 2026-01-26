import { describe, expect, it } from 'vitest';
import { calculateDriverPayCents } from './driver-pay';

describe('calculateDriverPayCents', () => {
  it('calculates hourly + bonus + tips', () => {
    const result = calculateDriverPayCents({
      activeMinutes: 90,
      hourlyRateCents: 2000,
      tipsCents: 300,
      bonusEligible: true,
      bonus5StarCents: 500,
    });

    expect(result).toEqual({
      hourlyPayCents: 3000,
      bonusPayCents: 500,
      totalPayCents: 3800,
    });
  });

  it('never returns negative cents', () => {
    const result = calculateDriverPayCents({
      activeMinutes: -1,
      hourlyRateCents: -5,
      tipsCents: -10,
      bonusEligible: true,
      bonus5StarCents: -20,
    });

    expect(result).toEqual({
      hourlyPayCents: 0,
      bonusPayCents: 0,
      totalPayCents: 0,
    });
  });
});
