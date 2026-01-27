import { describe, expect, it } from 'vitest';
import { calculateDriverPayCents } from './driver-pay';
import { DriverTier } from '@prisma/client';

describe('calculateDriverPayCents', () => {
  it('calculates hourly pay + performance bonus + tips', () => {
    const result = calculateDriverPayCents({
      driverTier: DriverTier.STANDARD,
      activeMinutes: 60,
      tipsCents: 300,
      planName: 'OTW BASIC',
      bonusEligible: true,
      onTimeEligible: true,
      earlyEligible: false,
    });

    expect(result).toEqual({
      milePayCents: 0,
      waitBonusCents: 0,
      cashBonusCents: 0,
      businessBonusCents: 0,
      bonusPayCents: 500,
      performanceBonusCents: 500,
      speedBonusCents: 0,
      hourlyPayCents: 1800,
      tipsCents: 300,
      totalPayCents: 2600,
      rateCentsPerServiceMile: 0,
      hourlyRateCents: 1800,
    });
  });

  it('never returns negative cents', () => {
    const result = calculateDriverPayCents({
      driverTier: DriverTier.PROBATION,
      activeMinutes: -10,
      tipsCents: -10,
      planName: 'OTW BASIC',
      bonusEligible: true,
      onTimeEligible: true,
      earlyEligible: true,
    });

    expect(result).toEqual({
      milePayCents: 0,
      waitBonusCents: 0,
      cashBonusCents: 0,
      businessBonusCents: 0,
      bonusPayCents: 0,
      performanceBonusCents: 0,
      speedBonusCents: 0,
      hourlyPayCents: 0,
      tipsCents: 0,
      totalPayCents: 0,
      rateCentsPerServiceMile: 0,
      hourlyRateCents: 1600,
    });
  });

  it('uses tier 5-star bonus when eligible', () => {
    const result = calculateDriverPayCents({
      driverTier: DriverTier.ELITE,
      activeMinutes: 30,
      tipsCents: 0,
      planName: 'OTW ELITE',
      bonusEligible: true,
      onTimeEligible: true,
      earlyEligible: true,
    });

    expect(result).toEqual({
      milePayCents: 0,
      waitBonusCents: 0,
      cashBonusCents: 0,
      businessBonusCents: 0,
      bonusPayCents: 800,
      performanceBonusCents: 800,
      speedBonusCents: 0,
      hourlyPayCents: 1050,
      tipsCents: 0,
      totalPayCents: 1850,
      rateCentsPerServiceMile: 0,
      hourlyRateCents: 2100,
    });
  });
});
