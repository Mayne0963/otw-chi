// import { ServiceTypeEnum } from '@/lib/validation/request';

const BASE_FEE_CENTS = 500;
const PER_MILE_CENTS = 150;
const SERVICE_FEE_CENTS = 299;
const DRIVER_PAYOUT_RATE = 0.8;

export function estimatePrice(params: {
  miles: number;
  serviceType: 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE';
  tier: 'BASIC' | 'PLUS' | 'EXECUTIVE';
}) {
  return calculateBasePriceCents(params) / 100;
}

export function calculateBasePriceCents(params: {
  miles: number;
  serviceType: 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE';
}) {
  const surcharge =
    params.serviceType === 'FRAGILE' ? 250 :
    params.serviceType === 'CONCIERGE' ? 300 : 0;
  const miles = Number.isFinite(params.miles) ? Math.max(0, params.miles) : 0;
  const distanceCharge = Math.round(miles * PER_MILE_CENTS);
  return Math.max(0, BASE_FEE_CENTS + distanceCharge + surcharge);
}

export function calculatePriceBreakdownCents(params: {
  miles: number;
  serviceType: 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE';
  discount?: number;
  waiveServiceFee?: boolean;
}) {
  const basePriceCents = calculateBasePriceCents(params);
  const discount = Math.max(0, Math.min(1, params.discount ?? 0));
  const discountedBaseCents = Math.round(basePriceCents * (1 - discount));
  const serviceFeeCents = params.waiveServiceFee ? 0 : SERVICE_FEE_CENTS;
  const totalCents = Math.max(0, discountedBaseCents + serviceFeeCents);

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
  serviceType?: 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE';
  payoutRate?: number;
}) {
  const payoutRate = Math.max(0, Math.min(1, params.payoutRate ?? DRIVER_PAYOUT_RATE));
  const basePriceCents = params.basePriceCents ?? calculateBasePriceCents({
    miles: params.miles ?? 0,
    serviceType: params.serviceType ?? 'FOOD',
  });
  return Math.max(0, Math.floor(basePriceCents * payoutRate));
}
