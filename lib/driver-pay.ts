import type { DriverTier } from '@prisma/client';

const DEFAULT_RATE_CENTS_PER_SERVICE_MILE: Record<DriverTier, number> = {
  PROBATION: 150,
  STANDARD: 175,
  ELITE: 200,
  CONCIERGE: 225,
};

export function calculateDriverPayCents(input: {
  serviceMiles: number;
  driverTier: DriverTier;
  tipsCents: number;
  bonusEligible: boolean;
  bonus5StarCents: number;
  waitMiles?: number;
  cashHandling?: boolean;
  businessAccount?: boolean;
  rateCentsPerServiceMile?: Partial<Record<DriverTier, number>>;
}): {
  milePayCents: number;
  waitBonusCents: number;
  cashBonusCents: number;
  businessBonusCents: number;
  bonusPayCents: number;
  tipsCents: number;
  totalPayCents: number;
  rateCentsPerServiceMile: number;
} {
  const serviceMiles = Math.max(0, Math.trunc(input.serviceMiles));
  const waitMiles = Math.max(0, Math.trunc(input.waitMiles ?? 0));
  const tipsCents = Math.max(0, Math.trunc(input.tipsCents));
  const bonus5StarCents = Math.max(0, Math.trunc(input.bonus5StarCents));

  const rateMap = { ...DEFAULT_RATE_CENTS_PER_SERVICE_MILE, ...(input.rateCentsPerServiceMile ?? {}) };
  const rateCentsPerServiceMile = Math.max(0, Math.trunc(rateMap[input.driverTier] ?? 0));

  const milePayCents = serviceMiles * rateCentsPerServiceMile;
  const waitBonusCents = Math.max(0, waitMiles - 2) * 50;
  const cashBonusCents = input.cashHandling ? 750 : 0;
  const businessBonusCents = input.businessAccount ? 500 : 0;
  const bonusPayCents = input.bonusEligible ? bonus5StarCents : 0;
  const totalPayCents =
    milePayCents + waitBonusCents + cashBonusCents + businessBonusCents + bonusPayCents + tipsCents;

  return {
    milePayCents,
    waitBonusCents,
    cashBonusCents,
    businessBonusCents,
    bonusPayCents,
    tipsCents,
    totalPayCents,
    rateCentsPerServiceMile,
  };
}
