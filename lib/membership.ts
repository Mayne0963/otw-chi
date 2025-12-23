import { getPrisma } from '@/lib/db';
import { cache } from 'react';
import { MembershipSubscription, MembershipPlan } from '@/lib/generated/prisma';

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

export function getPlanCodeFromSubscription(sub: (MembershipSubscription & { plan: MembershipPlan }) | null): 'BASIC' | 'PLUS' | 'EXEC' | null {
  if (!sub || !sub.plan) return null;
  
  const name = sub.plan.name.toUpperCase();
  if (name.includes('BASIC')) return 'BASIC';
  if (name.includes('PLUS')) return 'PLUS';
  if (name.includes('EXECUTIVE') || name.includes('EXEC')) return 'EXEC';
  
  return null;
}

export function getMembershipBenefits(planCode: 'BASIC' | 'PLUS' | 'EXEC' | null) {
  switch (planCode) {
    case 'BASIC':
      return { discount: 0, nipMultiplier: 1.0, waiveServiceFee: false };
    case 'PLUS':
      return { discount: 0.10, nipMultiplier: 1.25, waiveServiceFee: false }; // 10% off
    case 'EXEC':
      return { discount: 0.20, nipMultiplier: 2.0, waiveServiceFee: true }; // 20% off + free service
    default:
      return { discount: 0, nipMultiplier: 1.0, waiveServiceFee: false };
  }
}
