'use server';
// import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { calculatePriceBreakdownCents } from '@/lib/pricing';

export async function getEstimateAction(formData: FormData) {
  'use server';
  
  const pickup = String(formData.get('pickup') ?? '');
  const dropoff = String(formData.get('dropoff') ?? '');
  const serviceType = String(formData.get('serviceType') ?? 'FOOD').toUpperCase();
  const miles = Number(formData.get('miles') ?? 1);

  if (!pickup || !dropoff || !miles) {
    throw new Error('Invalid form data');
  }

  const user = await getCurrentUser();
  let membershipBenefits = getMembershipBenefits(null);

  if (user) {
    const sub = await getActiveSubscription(user.id);
    const planCode = getPlanCodeFromSubscription(sub);
    membershipBenefits = getMembershipBenefits(planCode);
  }

  const pricing = calculatePriceBreakdownCents({
    miles,
    serviceType: serviceType as 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE',
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
