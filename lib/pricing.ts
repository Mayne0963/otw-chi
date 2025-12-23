// import { ServiceTypeEnum } from '@/lib/validation/request';

export function estimatePrice(params: {
  miles: number;
  serviceType: 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE';
  tier: 'BASIC' | 'PLUS' | 'EXECUTIVE';
}) {
  const baseFee = 5;
  const perMile = 1.5;
  const surcharge =
    params.serviceType === 'FRAGILE' ? 2.5 :
    params.serviceType === 'CONCIERGE' ? 3.0 : 0;
  const raw = baseFee + params.miles * perMile + surcharge;
  const final = Math.max(0, raw);
  return Math.round(final * 100) / 100;
}
