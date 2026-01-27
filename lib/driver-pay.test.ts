import { describe, expect, it } from 'vitest';
import { calculateDriverPayCents } from './driver-pay';
import { DriverTier } from '@prisma/client';

describe('calculateDriverPayCents', () => {
  it('calculates per-service-mile + bonus + tips', () => {
    const result = calculateDriverPayCents({
      serviceMiles: 12,
      driverTier: DriverTier.STANDARD,
      tipsCents: 300,
      bonusEligible: true,
      bonus5StarCents: 500,
    });

    expect(result).toEqual({
      milePayCents: 2100,
      waitBonusCents: 0,
      cashBonusCents: 0,
      businessBonusCents: 0,
      bonusPayCents: 500,
      tipsCents: 300,
      totalPayCents: 2900,
      rateCentsPerServiceMile: 175,
    });
  });

  it('never returns negative cents', () => {
    const result = calculateDriverPayCents({
      serviceMiles: -1,
      driverTier: DriverTier.PROBATION,
      tipsCents: -10,
      bonusEligible: true,
      bonus5StarCents: -20,
    });

    expect(result).toEqual({
      milePayCents: 0,
      waitBonusCents: 0,
      cashBonusCents: 0,
      businessBonusCents: 0,
      bonusPayCents: 0,
      tipsCents: 0,
      totalPayCents: 0,
      rateCentsPerServiceMile: 150,
    });
  });

  it('adds wait, cash, and business bonuses', () => {
    const result = calculateDriverPayCents({
      serviceMiles: 20,
      driverTier: DriverTier.ELITE,
      tipsCents: 0,
      bonusEligible: false,
      bonus5StarCents: 0,
      waitMiles: 6,
      cashHandling: true,
      businessAccount: true,
    });

    expect(result).toEqual({
      milePayCents: 4000,
      waitBonusCents: 200,
      cashBonusCents: 750,
      businessBonusCents: 500,
      bonusPayCents: 0,
      tipsCents: 0,
      totalPayCents: 5450,
      rateCentsPerServiceMile: 200,
    });
  });
});
