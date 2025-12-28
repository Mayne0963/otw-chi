import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { calculatePriceBreakdownCents } from '@/lib/pricing';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const miles = Number(formData.get('miles')) || 1;
    const serviceType = String(formData.get('serviceType') ?? 'FOOD').toUpperCase();

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

    return NextResponse.json({
      basePrice: pricing.basePriceCents,
      discountedPrice: pricing.totalCents,
      miles,
      discount: membershipBenefits.discount,
      waiveServiceFee: membershipBenefits.waiveServiceFee,
    });
  } catch (error) {
    console.error('Estimate error:', error);
    return new NextResponse('Invalid request', { status: 400 });
  }
}
