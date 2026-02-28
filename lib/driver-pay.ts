import type { DriverTier } from '@prisma/client';

const DEFAULT_HOURLY_RATE_CENTS: Record<DriverTier, number> = {
  PROBATION: 1600,
  STANDARD: 1800,
  ELITE: 2100,
  CONCIERGE: 2500,
};

const DEFAULT_5STAR_BONUS_CENTS: Record<DriverTier, number> = {
  PROBATION: 0,
  STANDARD: 500,
  ELITE: 800,
  CONCIERGE: 1000,
};

const DEFAULT_DRIVER_REVENUE_SHARE_RATE = 0.5;

function normalizeCents(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  return 0;
}

export function calculateDriverPayCents(input: {
  driverTier: DriverTier;
  activeMinutes: number;
  tipsCents: number;
  serviceMiles?: number;
  deliveryFeeCents?: number;
  revenueShareRate?: number;
  planName?: string | null;
  hourlyRateCents?: number;
  onTimeEligible?: boolean;
  earlyEligible?: boolean;
  bonusEligible?: boolean;
  bonus5StarCents?: number;
}): {
  milePayCents: number;
  waitBonusCents: number;
  cashBonusCents: number;
  businessBonusCents: number;
  bonusPayCents: number;
  performanceBonusCents: number;
  speedBonusCents: number;
  hourlyPayCents: number;
  tipsCents: number;
  totalPayCents: number;
  rateCentsPerServiceMile: number;
  hourlyRateCents: number;
} {
  const activeMinutes = Math.max(0, Math.trunc(input.activeMinutes));
  const tipsCents = Math.max(0, Math.trunc(input.tipsCents));

  const fallbackHourly = Math.max(0, Math.trunc(DEFAULT_HOURLY_RATE_CENTS[input.driverTier] ?? 0));
  const hourlyRateCents = Math.max(0, Math.trunc(input.hourlyRateCents ?? 0)) || fallbackHourly;

  const hourlyPayCents = Math.ceil((activeMinutes * hourlyRateCents) / 60);
  const serviceMiles = Math.max(0, Math.trunc(input.serviceMiles ?? 0));
  const deliveryFeeCents = normalizeCents(input.deliveryFeeCents);
  const revenueShareRate = Math.max(0, Math.min(1, input.revenueShareRate ?? DEFAULT_DRIVER_REVENUE_SHARE_RATE));
  const revenueSharePayCents =
    deliveryFeeCents > 0 ? Math.max(0, Math.round(deliveryFeeCents * revenueShareRate)) : 0;
  const basePayCents = deliveryFeeCents > 0 ? revenueSharePayCents : hourlyPayCents;

  const fallback5StarBonusCents = DEFAULT_5STAR_BONUS_CENTS[input.driverTier] ?? 0;
  const bonus5StarCents = normalizeCents(input.bonus5StarCents) || fallback5StarBonusCents;
  const bonusPayCents = Boolean(input.bonusEligible) && Boolean(input.onTimeEligible) ? bonus5StarCents : 0;
  const performanceBonusCents = bonusPayCents;
  const speedBonusCents = 0;

  const milePayCents = basePayCents;
  const waitBonusCents = 0;
  const cashBonusCents = 0;
  const businessBonusCents = 0;
  const rateCentsPerServiceMile =
    serviceMiles > 0 ? Math.max(0, Math.round(basePayCents / serviceMiles)) : 0;

  const totalPayCents = basePayCents + bonusPayCents + speedBonusCents + tipsCents;

  return {
    milePayCents,
    waitBonusCents,
    cashBonusCents,
    businessBonusCents,
    bonusPayCents,
    performanceBonusCents,
    speedBonusCents,
    hourlyPayCents,
    tipsCents,
    totalPayCents,
    rateCentsPerServiceMile,
    hourlyRateCents,
  };
}
