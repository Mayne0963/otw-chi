import { NextResponse } from 'next/server';
import { extractNeonAuthUserId, getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { sendZapierWebhook } from '@/lib/services/zapier';
import { canSendTransactionalEmails } from '@/lib/email/transactional';
import { sendDeliveryRequestAcknowledgementEmail } from '@/lib/customer-acknowledgements';
import { z } from 'zod';
import { OverageBillingMode } from '@prisma/client';
import {
  getActiveSubscriptionUncached,
  getMembershipBenefits,
  getPlanCodeFromSubscription,
} from '@/lib/membership';
import { getMembershipPlanPerks, resolveDeliveryPaymentPreferenceByPlan } from '@/lib/membership-perks';
import { calculatePriceBreakdownCents } from '@/lib/pricing';
import {
  DEFAULT_DISPATCH_LEAD_MINUTES,
  DEFAULT_SCHEDULE_WINDOW_MINUTES,
  submitDeliveryRequest,
} from '@/lib/delivery-submit';
import {
  buildRequestRouteSnapshot,
  calculateRequestRouteMiles,
  getChargeableStopCount,
} from '@/lib/request-stops';
import {
  buildOtwTrueJobSiteBusinessValidationAddress,
  syncOtwTrueEmployeeAccessForUser,
} from '@/lib/otw-true';
import { validateAddress } from '@/lib/geocoding';

export const runtime = 'nodejs';

const ServiceType = {
  FOOD: 'FOOD',
  STORE: 'STORE',
  FRAGILE: 'FRAGILE',
  CONCIERGE: 'CONCIERGE',
  RIDE: 'RIDE',
} as const;
type ServiceType = typeof ServiceType[keyof typeof ServiceType];
const ESTIMATED_MINUTES_PER_MILE = 5;
const DEFAULT_SCHEDULED_LEAD_MINUTES = 30;

const pickupCodeTypeSchema = z.union([
  z.enum(['QR', 'BARCODE', 'PIN', 'CONFIRMATION']),
  z.literal(''),
]);
const routeStopSchema = z.object({
  address: z.string().min(5),
  lat: z.number().finite(),
  lng: z.number().finite(),
  label: z.string().max(160).optional(),
});
const requestSchema = z.object({
  pickup: z.string().min(5),
  dropoff: z.string().min(5),
  pickupLat: z.number().finite().optional(),
  pickupLng: z.number().finite().optional(),
  pickupLabel: z.string().max(160).optional(),
  dropoffLat: z.number().finite().optional(),
  dropoffLng: z.number().finite().optional(),
  dropoffLabel: z.string().max(160).optional(),
  intermediateStops: z.array(routeStopSchema).optional(),
  serviceType: z.enum(['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE', 'RIDE']),
  notes: z.string().optional(),
  costEstimate: z.number().int().positive().optional(),
  milesEstimate: z.number().positive(),
  orderReference: z.string().max(120).optional(),
  pickupInstructions: z.string().max(2000).optional(),
  dropoffInstructions: z.string().max(2000).optional(),
  pickupCodeType: pickupCodeTypeSchema.optional(),
  pickupCodeText: z.string().max(255).optional(),
  paymentPreference: z.enum(['INSTANT', 'MONTHLY']).optional(),
  otwTrueBenefitType: z.enum(['FOOD_JOB_SITE', 'COMMUTE_RIDE', 'ROADSIDE_ASSIST']).optional(),
  isScheduled: z.boolean().optional(),
  scheduledFor: z.string().datetime().optional(),
  scheduleWindowMinutes: z.number().int().min(5).max(180).optional(),
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
    const user = await prisma.user.findUnique({
      where: { neonAuthId: neonAuthUserId },
      select: {
        id: true,
        email: true,
        name: true,
        customerProfile: { select: { phone: true } },
      },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const data = requestSchema.parse(body);
    const otwTrueEntitlement = await syncOtwTrueEmployeeAccessForUser(prisma, {
      userId: user.id,
      email: user.email,
    });
    const intermediateStops = data.intermediateStops ?? [];

    let activeSubscription = null;
    let planCode = getPlanCodeFromSubscription(null);
    let benefits = getMembershipBenefits(planCode);
    try {
      activeSubscription = await getActiveSubscriptionUncached(user.id);
      planCode = getPlanCodeFromSubscription(activeSubscription);
      benefits = getMembershipBenefits(planCode);
    } catch {
      planCode = getPlanCodeFromSubscription(null);
      benefits = getMembershipBenefits(planCode);
      activeSubscription = null;
    }

    const planPerks = getMembershipPlanPerks(activeSubscription?.plan);
    if (intermediateStops.length > 0 && !planPerks.canUseMultiStop) {
      return NextResponse.json(
        { error: 'Multi-stop requests require an active OTW Elite or higher membership.' },
        { status: 403 },
      );
    }

    const pickupLocation =
      Number.isFinite(data.pickupLat) && Number.isFinite(data.pickupLng)
        ? {
            address: data.pickup,
            lat: Number(data.pickupLat),
            lng: Number(data.pickupLng),
            label: data.pickupLabel,
          }
        : null;
    let effectiveDropoffAddress = data.dropoff;
    let dropoffLocation =
      Number.isFinite(data.dropoffLat) && Number.isFinite(data.dropoffLng)
        ? {
            address: data.dropoff,
            lat: Number(data.dropoffLat),
            lng: Number(data.dropoffLng),
            label: data.dropoffLabel,
          }
        : null;

    if (data.otwTrueBenefitType === 'FOOD_JOB_SITE') {
      const jobSiteBusiness = otwTrueEntitlement?.jobSiteBusiness;
      if (!jobSiteBusiness) {
        return NextResponse.json(
          {
            error:
              'Your linked OTW True business has not saved a job-site address yet. Ask the business owner to update Membership Manage before placing this request.',
          },
          { status: 400 },
        );
      }

      const resolvedJobSite = await validateAddress(
        buildOtwTrueJobSiteBusinessValidationAddress(jobSiteBusiness),
      ).catch(() => null);
      if (!resolvedJobSite) {
        return NextResponse.json(
          {
            error:
              'We could not verify the saved OTW True business address. Ask the business owner to review the business profile address before placing this request.',
          },
          { status: 400 },
        );
      }

      effectiveDropoffAddress = resolvedJobSite.formattedAddress;
      dropoffLocation = {
        address: resolvedJobSite.formattedAddress,
        lat: resolvedJobSite.latitude,
        lng: resolvedJobSite.longitude,
        label: jobSiteBusiness.businessLegalName,
      };
    }

    const routeStopsSnapshot = buildRequestRouteSnapshot({
      pickup: pickupLocation,
      intermediateStops,
      dropoff: dropoffLocation,
    });

    if (intermediateStops.length > 0 && !routeStopsSnapshot) {
      return NextResponse.json(
        { error: 'Multi-stop requests require coordinates for every stop.' },
        { status: 400 },
      );
    }

    const miles = routeStopsSnapshot
      ? calculateRequestRouteMiles(routeStopsSnapshot.stops)
      : Number(data.milesEstimate);
    const milesEstimate = Math.max(0, Math.round(miles));
    const numberOfStops = routeStopsSnapshot
      ? getChargeableStopCount(routeStopsSnapshot.stops.length)
      : 1;

    const billingMode = activeSubscription?.plan?.overageBillingMode ?? OverageBillingMode.INSTANT;
    const isScheduled = data.isScheduled === true;
    let scheduledFor: Date | null = null;

    if (isScheduled) {
      if (!data.scheduledFor) {
        return NextResponse.json({ error: 'scheduledFor is required when isScheduled is true' }, { status: 400 });
      }
      const parsedScheduledFor = new Date(data.scheduledFor);
      if (Number.isNaN(parsedScheduledFor.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledFor' }, { status: 400 });
      }
      if (parsedScheduledFor.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'scheduledFor must be in the future' }, { status: 400 });
      }
      scheduledFor = parsedScheduledFor;
    }

    const scheduleWindowMinutes = Number.isFinite(data.scheduleWindowMinutes)
      ? Math.min(180, Math.max(5, Math.round(Number(data.scheduleWindowMinutes))))
      : DEFAULT_SCHEDULE_WINDOW_MINUTES;
    const scheduledStart =
      scheduledFor ?? new Date(Date.now() + DEFAULT_SCHEDULED_LEAD_MINUTES * 60 * 1000);
    const dispatchAt = scheduledFor
      ? new Date(scheduledFor.getTime() - DEFAULT_DISPATCH_LEAD_MINUTES * 60 * 1000)
      : null;
    const paymentPreference = resolveDeliveryPaymentPreferenceByPlan(
      activeSubscription?.plan,
      data.paymentPreference,
    );
    const overageBillingModeOverride =
      paymentPreference === 'MONTHLY' ? OverageBillingMode.INVOICE : OverageBillingMode.INSTANT;
    const hasActivePlan = Boolean(activeSubscription?.plan);
    const pricing = calculatePriceBreakdownCents({
      miles,
      serviceType: data.serviceType,
      discount: benefits.discount,
      waiveServiceFee: benefits.waiveServiceFee,
    });

    if (hasActivePlan) {
      const travelMinutes = Math.max(5, Math.round(Math.max(0.1, miles) * ESTIMATED_MINUTES_PER_MILE));

      const result = await submitDeliveryRequest({
        userId: user.id,
        serviceType: data.serviceType,
        pickupAddress: data.pickup,
        dropoffAddress: effectiveDropoffAddress,
        notes: data.notes,
        scheduledStart,
        scheduledFor,
        isScheduled,
        scheduleWindowMinutes,
        travelMinutes,
        waitMinutes: 0,
        sitAndWait: false,
        numberOfStops,
        returnOrExchange: false,
        cashHandling: false,
        peakHours: false,
        payWithMiles: true,
        overageBillingModeOverride,
        deliveryFeeCents: pricing.totalCents,
        otwTrueBenefitType: data.otwTrueBenefitType,
        pickupLocation,
        dropoffLocation,
        intermediateStops,
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

      const deliveryFeeCents = Number.isFinite(result.request.deliveryFeeCents)
        ? Math.max(0, Math.round(Number(result.request.deliveryFeeCents)))
        : 0;
      const deliveryPaymentRequired =
        paymentPreference !== 'MONTHLY' &&
        deliveryFeeCents > 0 &&
        result.request.deliveryFeePaid !== true;

      const deliveryPaymentIntentId: string | null = result.request.deliveryPaymentIntentId ?? null;
      const deliveryClientSecret: string | null = null;

      const paymentRequired = result.paymentRequired || deliveryPaymentRequired;

      if (result.request.paymentRequired !== paymentRequired) {
        await prisma.deliveryRequest.update({
          where: { id: result.request.id },
          data: { paymentRequired },
        });
      }

      await sendZapierWebhook('job_request_created', {
        schemaVersion: 1,
        requestId: result.request.id,
        submittedAt: new Date().toISOString(),
        businessType: 'otw',
        feature: 'job_requests',
        action: 'created',
        entityType: 'job_request',
        entityId: result.request.id,
        orderId: result.request.id,
        customerName: user.name || '',
        customerEmail: user.email || '',
        customerPhone: user.customerProfile?.phone || '',
        orderType: data.serviceType,
        serviceType: data.serviceType,
        pickupAddress: data.pickup,
        dropoffAddress: effectiveDropoffAddress,
        notes: data.notes ?? '',
        paymentPreference: data.paymentPreference ?? null,
        paymentPreferenceResolved: paymentPreference,
        milesInput: data.milesEstimate,
        milesComputed: miles,
        milesEstimate,
        pickupLat: pickupLocation?.lat ?? null,
        pickupLng: pickupLocation?.lng ?? null,
        dropoffLat: dropoffLocation?.lat ?? null,
        dropoffLng: dropoffLocation?.lng ?? null,
        intermediateStops,
        isScheduled,
        scheduledFor: scheduledFor?.toISOString() ?? null,
        scheduleWindowMinutes,
        otwTrueBenefitType: data.otwTrueBenefitType ?? null,
        job: {
          serviceType: data.serviceType,
          pickupAddress: data.pickup,
          dropoffAddress: effectiveDropoffAddress,
          notes: data.notes ?? '',
          milesEstimate,
        },
        jobRequest: {
          pickupAddress: data.pickup,
          dropoffAddress: effectiveDropoffAddress,
          serviceType: data.serviceType,
          notes: data.notes ?? '',
          paymentPreference: data.paymentPreference ?? null,
          milesInput: data.milesEstimate,
          milesComputed: miles,
          milesEstimate,
          pickupLat: pickupLocation?.lat ?? null,
          pickupLng: pickupLocation?.lng ?? null,
          dropoffLat: dropoffLocation?.lat ?? null,
          dropoffLng: dropoffLocation?.lng ?? null,
          intermediateStops,
          isScheduled,
          scheduledFor: scheduledFor?.toISOString() ?? null,
          scheduleWindowMinutes,
          otwTrueBenefitType: data.otwTrueBenefitType ?? null,
        },
        totalEstimated: deliveryFeeCents / 100,
        totalAmount: deliveryFeeCents / 100,
        status: paymentRequired ? 'Awaiting Payment' : 'New',
        paymentRequired,
        source: 'otw_webapp',
      });

      if (user.email && canSendTransactionalEmails()) {
        try {
          await sendDeliveryRequestAcknowledgementEmail({
            toEmail: user.email,
            customerName: user.name,
            requestId: result.request.id,
            serviceType: data.serviceType,
            pickupAddress: data.pickup,
            dropoffAddress: effectiveDropoffAddress,
            scheduledFor,
            notes: data.notes,
          });
        } catch (emailError) {
          console.error('[OTW REQUESTS] Failed to send customer acknowledgment email:', emailError);
        }
      }

      return NextResponse.json({
        id: result.request.id,
        paymentPreference,
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

    const paymentRequired = paymentPreference !== 'MONTHLY' && pricing.totalCents > 0;
    const hasBillableDeliveryFee = pricing.totalCents > 0;
    const deliveryFeePaid = hasBillableDeliveryFee ? false : true;

    if (data.otwTrueBenefitType) {
      return NextResponse.json(
        { error: 'OTW True benefits require an active linked membership before request submission' },
        { status: 400 },
      );
    }

    const request = await prisma.deliveryRequest.create({
        data: {
          userId: user.id,
          pickupAddress: data.pickup,
          dropoffAddress: effectiveDropoffAddress,
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
        quoteBreakdown: routeStopsSnapshot
          ? {
              routeStops: routeStopsSnapshot,
            }
          : undefined,
        scheduledStart,
        scheduledFor,
        isScheduled,
        scheduleWindowMinutes,
        dispatchAt,
      },
    });

    const deliveryClientSecret: string | null = null;
    const deliveryPaymentIntentId: string | null = request.deliveryPaymentIntentId ?? null;

    await sendZapierWebhook('job_request_created', {
      schemaVersion: 1,
      requestId: request.id,
      submittedAt: new Date().toISOString(),
      businessType: 'otw',
      feature: 'job_requests',
      action: 'created',
      entityType: 'job_request',
      entityId: request.id,
      orderId: request.id,
      customerName: user.name || '',
      customerEmail: user.email || '',
      customerPhone: user.customerProfile?.phone || '',
      orderType: data.serviceType,
      serviceType: data.serviceType,
      pickupAddress: data.pickup,
      dropoffAddress: effectiveDropoffAddress,
      notes: data.notes ?? '',
      paymentPreference: data.paymentPreference ?? null,
      paymentPreferenceResolved: paymentPreference,
      milesInput: data.milesEstimate,
      milesComputed: miles,
      milesEstimate,
      pickupLat: pickupLocation?.lat ?? null,
      pickupLng: pickupLocation?.lng ?? null,
      dropoffLat: dropoffLocation?.lat ?? null,
      dropoffLng: dropoffLocation?.lng ?? null,
      intermediateStops,
      isScheduled,
      scheduledFor: scheduledFor?.toISOString() ?? null,
      scheduleWindowMinutes,
      job: {
        serviceType: data.serviceType,
        pickupAddress: data.pickup,
        dropoffAddress: effectiveDropoffAddress,
        notes: data.notes ?? '',
        milesEstimate,
      },
      jobRequest: {
        pickupAddress: data.pickup,
        dropoffAddress: effectiveDropoffAddress,
        serviceType: data.serviceType,
        notes: data.notes ?? '',
        paymentPreference: data.paymentPreference ?? null,
        milesInput: data.milesEstimate,
        milesComputed: miles,
        milesEstimate,
        pickupLat: pickupLocation?.lat ?? null,
        pickupLng: pickupLocation?.lng ?? null,
        dropoffLat: dropoffLocation?.lat ?? null,
        dropoffLng: dropoffLocation?.lng ?? null,
        intermediateStops,
        isScheduled,
        scheduledFor: scheduledFor?.toISOString() ?? null,
        scheduleWindowMinutes,
      },
      totalEstimated: (request.deliveryFeeCents ?? 0) / 100,
      totalAmount: (request.deliveryFeeCents ?? 0) / 100,
      status: paymentRequired ? 'Awaiting Payment' : 'New',
      paymentRequired,
      source: 'otw_webapp',
    });

    if (user.email && canSendTransactionalEmails()) {
      try {
        await sendDeliveryRequestAcknowledgementEmail({
          toEmail: user.email,
          customerName: user.name,
          requestId: request.id,
          serviceType: data.serviceType,
          pickupAddress: data.pickup,
          dropoffAddress: effectiveDropoffAddress,
          scheduledFor,
          notes: data.notes,
        });
      } catch (emailError) {
        console.error('[OTW REQUESTS] Failed to send customer acknowledgment email:', emailError);
      }
    }

    return NextResponse.json({
      id: request.id,
      paymentPreference,
      paymentRequired,
      deliveryPaymentRequired: paymentRequired,
      deliveryFeeCents: request.deliveryFeeCents,
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
