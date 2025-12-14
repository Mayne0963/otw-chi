import { ServiceTypeEnum } from '@/lib/validation/request';

type MembershipTier = 'BASIC' | 'PLUS' | 'EXECUTIVE';

export function estimatePrice(params: {
  miles: number;
  serviceType: 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE';
  tier: MembershipTier;
}) {
  const baseFee = 5;
  const perMile = 1.5;
  const surcharge =
    params.serviceType === 'FRAGILE' ? 2.5 :
    params.serviceType === 'CONCIERGE' ? 3.0 : 0;
  const discount =
    params.tier === 'PLUS' ? 0.1 :
    params.tier === 'EXECUTIVE' ? 0.2 : 0;
  const raw = baseFee + params.miles * perMile + surcharge;
  const final = Math.max(0, raw * (1 - discount));
  return Math.round(final * 100) / 100;
}
