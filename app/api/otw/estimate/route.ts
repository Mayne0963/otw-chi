import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { calculatePriceBreakdownCents } from '@/lib/pricing';
import { calculateServiceMiles } from '@/lib/service-miles';
import { ServiceType } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const miles = Number(formData.get('miles')) || 1;
    const durationMinutes = Number(formData.get('durationMinutes')) || Math.ceil(miles * 3);
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

    const milesQuote = calculateServiceMiles({
      travelMinutes: durationMinutes,
      serviceType: serviceType as ServiceType,
      scheduledStart: new Date(),
      quotedAt: new Date(),
    });

    return NextResponse.json({
      basePrice: pricing.basePriceCents,
      discountedPrice: pricing.totalCents,
      miles,
      discount: membershipBenefits.discount,
      waiveServiceFee: membershipBenefits.waiveServiceFee,
      serviceMiles: milesQuote.serviceMilesFinal,
    });
  } catch (error) {
    console.error('Estimate error:', error);
    return new NextResponse('Invalid request', { status: 400 });
  }
}
