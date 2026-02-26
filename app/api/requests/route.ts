import { NextResponse } from 'next/server';
import { extractNeonAuthUserId, getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';
import { OverageBillingMode } from '@prisma/client';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { calculatePriceBreakdownCents } from '@/lib/pricing';
import { submitDeliveryRequest } from '@/lib/delivery-submit';
import {
  ensureDeliveryFeePaymentIntentForRequest,
  shouldRequireDeliveryFeePayment,
} from '@/lib/delivery-payment';

export const runtime = 'nodejs';

const ServiceType = {
  FOOD: 'FOOD',
  STORE: 'STORE',
  FRAGILE: 'FRAGILE',
  CONCIERGE: 'CONCIERGE',
} as const;
type ServiceType = typeof ServiceType[keyof typeof ServiceType];
const ESTIMATED_MINUTES_PER_MILE = 5;
const DEFAULT_SCHEDULED_LEAD_MINUTES = 30;

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

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

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

    let activeSubscription = null;
    let benefits = getMembershipBenefits(null);
    try {
      activeSubscription = await getActiveSubscription(user.id);
      benefits = getMembershipBenefits(getPlanCodeFromSubscription(activeSubscription));
    } catch {
      benefits = getMembershipBenefits(null);
      activeSubscription = null;
    }

    const hasActivePlan = Boolean(activeSubscription?.plan);

    if (hasActivePlan) {
      const travelMinutes = Math.max(5, Math.round(Math.max(0.1, miles) * ESTIMATED_MINUTES_PER_MILE));
      const scheduledStart = new Date(Date.now() + DEFAULT_SCHEDULED_LEAD_MINUTES * 60 * 1000);

      const result = await submitDeliveryRequest({
        userId: user.id,
        serviceType: data.serviceType,
        pickupAddress: data.pickup,
        dropoffAddress: data.dropoff,
        notes: data.notes,
        scheduledStart,
        travelMinutes,
        waitMinutes: 0,
        sitAndWait: false,
        numberOfStops: 1,
        returnOrExchange: false,
        cashHandling: false,
        peakHours: false,
        payWithMiles: true,
      });

      await prisma.deliveryRequest.update({
        where: { id: result.request.id },
        data: {
          orderReference: normalizeOptionalString(data.orderReference),
          pickupInstructions: normalizeOptionalString(data.pickupInstructions),
          dropoffInstructions: normalizeOptionalString(data.dropoffInstructions),
          pickupCodeType: normalizeOptionalString(data.pickupCodeType),
          pickupCodeText: normalizeOptionalString(data.pickupCodeText),
        },
      });

      const deliveryPaymentRequired = shouldRequireDeliveryFeePayment({
        deliveryFeeCents: result.request.deliveryFeeCents,
        deliveryFeePaid: result.request.deliveryFeePaid,
        billingMode: result.request.overageBillingMode,
      });

      let deliveryPaymentIntentId: string | null = result.request.deliveryPaymentIntentId ?? null;
      let deliveryClientSecret: string | null = null;

      if (deliveryPaymentRequired) {
        try {
          const intent = await ensureDeliveryFeePaymentIntentForRequest(result.request.id);
          deliveryPaymentIntentId = intent.paymentIntentId;
          deliveryClientSecret = intent.clientSecret;
        } catch (intentError) {
          console.error('[CREATE_REQUEST_DELIVERY_PAYMENT_INTENT]', {
            requestId: result.request.id,
            message: intentError instanceof Error ? intentError.message : intentError,
          });
        }
      }

      const paymentRequired = result.paymentRequired || deliveryPaymentRequired;

      return NextResponse.json({
        id: result.request.id,
        paymentRequired,
        deliveryPaymentRequired,
        deliveryFeeCents: result.request.deliveryFeeCents,
        deliveryClientSecret,
        deliveryPaymentIntentId,
        overageMiles: result.overageMiles,
        overageCents: result.overageCents,
        overageBillingMode: result.overageBillingMode,
        overagePaymentIntentId: result.overagePaymentIntentId,
        overageClientSecret: result.overageClientSecret,
      });
    }

    const pricing = calculatePriceBreakdownCents({
      miles,
      serviceType: data.serviceType,
      discount: benefits.discount,
      waiveServiceFee: benefits.waiveServiceFee,
    });
    const billingMode = activeSubscription?.plan?.overageBillingMode ?? OverageBillingMode.INSTANT;
    const paymentRequired = shouldRequireDeliveryFeePayment({
      deliveryFeeCents: pricing.totalCents,
      deliveryFeePaid: false,
      billingMode,
    });
    const hasBillableDeliveryFee = pricing.totalCents > 0;
    const deliveryFeePaid = hasBillableDeliveryFee ? false : true;

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
        deliveryFeePaid,
        paymentRequired,
        overageBillingMode: billingMode,
        serviceMilesFinal: milesEstimate,
      },
    });

    let deliveryClientSecret: string | null = null;
    let deliveryPaymentIntentId: string | null = request.deliveryPaymentIntentId ?? null;

    if (paymentRequired) {
      try {
        const paymentIntent = await ensureDeliveryFeePaymentIntentForRequest(request.id);
        deliveryClientSecret = paymentIntent.clientSecret;
        deliveryPaymentIntentId = paymentIntent.paymentIntentId;
      } catch (intentError) {
        console.error('[CREATE_REQUEST_DELIVERY_PAYMENT_INTENT]', {
          requestId: request.id,
          message: intentError instanceof Error ? intentError.message : intentError,
        });
      }
    }

    return NextResponse.json({
      id: request.id,
      paymentRequired,
      deliveryPaymentRequired: paymentRequired,
      deliveryClientSecret,
      deliveryPaymentIntentId,
      overageMiles: request.overageMiles,
      overageCents: request.overageCents,
      overageBillingMode: request.overageBillingMode,
      overagePaymentIntentId: request.overagePaymentIntentId,
      overageClientSecret: null,
    });
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
