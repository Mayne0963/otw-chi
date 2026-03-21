'use server';
// import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { calculatePriceBreakdownCents } from '@/lib/pricing';
import { isServiceTypeAllowedForPlan } from '@/lib/service-miles-access';
import { ServiceType } from '@prisma/client';

export async function getEstimateAction(formData: FormData) {
  'use server';
  
  const pickup = String(formData.get('pickup') ?? '');
  const dropoff = String(formData.get('dropoff') ?? '');
  const serviceTypeRaw = String(formData.get('serviceType') ?? 'FOOD').toUpperCase();
  const serviceType = (['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE', 'RIDE'].includes(serviceTypeRaw)
    ? serviceTypeRaw
    : 'FOOD') as ServiceType;
  const miles = Number(formData.get('miles') ?? 1);

  if (!pickup || !dropoff || !miles) {
    throw new Error('Invalid form data');
  }

  const user = await getCurrentUser();
  let membershipBenefits = getMembershipBenefits(null);

  if (user) {
    const sub = await getActiveSubscription(user.id);
    if (sub?.plan && !isServiceTypeAllowedForPlan(sub.plan.allowedServiceTypes, serviceType)) {
      throw new Error(`Service type ${serviceType} is not available on your plan.`);
    }
    const planCode = getPlanCodeFromSubscription(sub);
    membershipBenefits = getMembershipBenefits(planCode);
  }

  const pricing = calculatePriceBreakdownCents({
    miles,
    serviceType: serviceType as 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE' | 'RIDE',
    discount: membershipBenefits.discount,
    waiveServiceFee: membershipBenefits.waiveServiceFee,
  });

  return {
    basePrice: pricing.basePriceCents,
    discountedPrice: pricing.totalCents,
    discount: membershipBenefits.discount,
    nipMultiplier: membershipBenefits.nipMultiplier,
    waiveServiceFee: membershipBenefits.waiveServiceFee,
  };
}
