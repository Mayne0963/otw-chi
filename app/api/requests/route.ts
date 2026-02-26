import { NextResponse } from 'next/server';
import { extractNeonAuthUserId, getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { calculatePriceBreakdownCents } from '@/lib/pricing';

export const runtime = 'nodejs';

const ServiceType = {
  FOOD: 'FOOD',
  STORE: 'STORE',
  FRAGILE: 'FRAGILE',
  CONCIERGE: 'CONCIERGE',
} as const;
type ServiceType = typeof ServiceType[keyof typeof ServiceType];
const pickupCodeTypeSchema = z.union([
  z.enum(['QR', 'BARCODE', 'PIN', 'CONFIRMATION']),
  z.literal(''),
]);
const requestSchema = z.object({
  pickup: z.string().min(5),
  dropoff: z.string().min(5),
  serviceType: z.enum(['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE']),
  notes: z.string().optional(),
  costEstimate: z.number().int().positive().optional(),
  milesEstimate: z.number().positive(),
  orderReference: z.string().max(120).optional(),
  pickupInstructions: z.string().max(2000).optional(),
  dropoffInstructions: z.string().max(2000).optional(),
  pickupCodeType: pickupCodeTypeSchema.optional(),
  pickupCodeText: z.string().max(255).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getNeonSession();
    const neonAuthUserId = extractNeonAuthUserId(session);
    
    if (!neonAuthUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { neonAuthId: neonAuthUserId } });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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

    const request = await prisma.deliveryRequest.create({
      data: {
        userId: user.id,
        pickupAddress: data.pickup,
        dropoffAddress: data.dropoff,
        serviceType: data.serviceType as ServiceType,
        notes: data.notes,
        orderReference: data.orderReference?.trim() || null,
        pickupInstructions: data.pickupInstructions?.trim() || null,
        dropoffInstructions: data.dropoffInstructions?.trim() || null,
        pickupCodeType: data.pickupCodeType?.trim() || null,
        pickupCodeText: data.pickupCodeText?.trim() || null,
        status: 'REQUESTED',
        deliveryFeeCents: pricing.totalCents,
        serviceMilesFinal: milesEstimate,
      },
    });

    return NextResponse.json({ id: request.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: error.issues,
        },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    console.error('Create request error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
