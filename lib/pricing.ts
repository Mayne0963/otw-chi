// import { ServiceTypeEnum } from '@/lib/validation/request';

const PRICING_TABLE = {
  FOOD: {
    base: 349,
    perMile: 110,
    serviceFee: 199,
    minimum: 649,
  },
  STORE: {
    base: 399,
    perMile: 120,
    serviceFee: 199,
    minimum: 699,
  },
  FRAGILE: {
    base: 499,
    perMile: 130,
    serviceFee: 249,
    minimum: 899,
  },
  CONCIERGE: {
    base: 699,
    perMile: 150,
    serviceFee: 299,
    minimum: 1099,
  },
} as const;

type ServiceType = keyof typeof PRICING_TABLE;

const DRIVER_PAYOUT_RATE = 0.8;

export function estimatePrice(params: {
  miles: number;
  serviceType: ServiceType;
  tier: 'BASIC' | 'PLUS' | 'EXECUTIVE';
}) {
  return calculateBasePriceCents(params) / 100;
}

export function calculateBasePriceCents(params: {
  miles: number;
  serviceType: ServiceType;
}) {
  const config = PRICING_TABLE[params.serviceType];
  const miles = Number.isFinite(params.miles) ? Math.max(0, params.miles) : 0;
  const distanceCharge = Math.round(miles * config.perMile);
  return config.base + distanceCharge;
}

export function calculatePriceBreakdownCents(params: {
  miles: number;
  serviceType: ServiceType;
  discount?: number;
  waiveServiceFee?: boolean;
}) {
  const config = PRICING_TABLE[params.serviceType];
  const basePriceCents = calculateBasePriceCents(params);
  const discount = Math.max(0, Math.min(1, params.discount ?? 0));
  const discountedBaseCents = Math.round(basePriceCents * (1 - discount));
  const serviceFeeCents = params.waiveServiceFee ? 0 : config.serviceFee;
  const totalBeforeFloor = discountedBaseCents + serviceFeeCents;
  const totalCents = Math.max(config.minimum, totalBeforeFloor);

  return {
    basePriceCents,
    discountedBaseCents,
    serviceFeeCents,
    totalCents,
  };
}

export function calculateDriverPayoutCents(params: {
  basePriceCents?: number;
  miles?: number;
  serviceType?: ServiceType;
  payoutRate?: number;
}) {
  const payoutRate = Math.max(0, Math.min(1, params.payoutRate ?? DRIVER_PAYOUT_RATE));
  const basePriceCents = params.basePriceCents ?? calculateBasePriceCents({
    miles: params.miles ?? 0,
    serviceType: params.serviceType ?? 'FOOD',
  });
  return Math.max(0, Math.floor(basePriceCents * payoutRate));
}
