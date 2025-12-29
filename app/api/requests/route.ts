import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { calculatePriceBreakdownCents } from '@/lib/pricing';

const ServiceType = {
  FOOD: 'FOOD',
  STORE: 'STORE',
  FRAGILE: 'FRAGILE',
  CONCIERGE: 'CONCIERGE',
} as const;
type ServiceType = typeof ServiceType[keyof typeof ServiceType];
const requestSchema = z.object({
  pickup: z.string().min(5),
  dropoff: z.string().min(5),
  serviceType: z.enum(['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE']),
  notes: z.string().optional(),
  costEstimate: z.number().int().positive(),
  milesEstimate: z.number().positive(),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }
    
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
    
    if (!user) {
        return new NextResponse('User not found', { status: 404 });
    }

    const body = await req.json();
    const data = requestSchema.parse(body);
    const miles = Number(data.milesEstimate);
    const milesEstimate = Math.max(0, Math.round(miles));
    let benefits = getMembershipBenefits(null);
    try {
      const sub = await getActiveSubscription(user.id);
      benefits = getMembershipBenefits(getPlanCodeFromSubscription(sub));
    } catch {
      benefits = getMembershipBenefits(null);
    }
    const pricing = calculatePriceBreakdownCents({
      miles,
      serviceType: data.serviceType,
      discount: benefits.discount,
      waiveServiceFee: benefits.waiveServiceFee,
    });

    const request = await prisma.request.create({
      data: {
        customerId: user.id,
        pickup: data.pickup,
        dropoff: data.dropoff,
        serviceType: data.serviceType as ServiceType,
        notes: data.notes,
        status: 'SUBMITTED',
        costEstimate: pricing.totalCents,
        milesEstimate,
      },
    });

    return NextResponse.json({ id: request.id });
  } catch (error) {
    console.error('Create request error:', error);
    return new NextResponse('Invalid request', { status: 400 });
  }
}
