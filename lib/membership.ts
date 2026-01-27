import { getPrisma } from '@/lib/db';
import { cache } from 'react';
import { MembershipSubscription, MembershipPlan } from '@prisma/client';

export const getActiveSubscription = cache(async (userId: string) => {
  const prisma = getPrisma();
  const sub = await prisma.membershipSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!sub) return null;

  // Check if actually active
  const isValidStatus = ['ACTIVE', 'TRIALING'].includes(sub.status);
  const isNotExpired = sub.currentPeriodEnd ? sub.currentPeriodEnd > new Date() : true;

  if (isValidStatus && isNotExpired) {
    return sub;
  }
  
  return null;
});

export type MembershipPlanCode =
  | 'OTW_BASIC'
  | 'OTW_PLUS'
  | 'OTW_PRO'
  | 'OTW_ELITE'
  | 'OTW_BLACK'
  | 'OTW_BUSINESS'
  | null;

export function getPlanCodeFromSubscription(
  sub: (MembershipSubscription & { plan: MembershipPlan | null }) | null
): MembershipPlanCode {
  if (!sub || !sub.plan) return null;
  
  const name = sub.plan.name.toUpperCase();
  if (name === 'OTW BASIC') return 'OTW_BASIC';
  if (name === 'OTW PLUS') return 'OTW_PLUS';
  if (name === 'OTW PRO') return 'OTW_PRO';
  if (name === 'OTW ELITE') return 'OTW_ELITE';
  if (name === 'OTW BLACK') return 'OTW_BLACK';
  if (name.startsWith('OTW BUSINESS') || name === 'OTW ENTERPRISE') return 'OTW_BUSINESS';
  
  return null;
}

export function getMembershipBenefits(planCode: MembershipPlanCode) {
  switch (planCode) {
    case 'OTW_BLACK':
    case 'OTW_BUSINESS':
      return { discount: 0, nipMultiplier: 1.0, waiveServiceFee: true };
    case 'OTW_BASIC':
    case 'OTW_PLUS':
    case 'OTW_PRO':
    case 'OTW_ELITE':
    default:
      return { discount: 0, nipMultiplier: 1.0, waiveServiceFee: false };
  }
}
