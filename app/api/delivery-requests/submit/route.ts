import { NextResponse } from 'next/server';
import { z } from 'zod';
import { OverageBillingMode, ServiceType } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import {
  DEFAULT_SCHEDULE_WINDOW_MINUTES,
  submitDeliveryRequest,
} from '@/lib/delivery-submit';
import { verifyServiceMilesQuoteToken } from '@/lib/service-miles-quote-token';
import {
  getActiveSubscriptionUncached,
} from '@/lib/membership';
import { resolveDeliveryPaymentPreferenceByPlan } from '@/lib/membership-perks';
import {
  ensureDeliveryFeePaymentIntentForRequest,
} from '@/lib/delivery-payment';
import {
  buildOtwTrueJobSiteBusinessValidationAddress,
  syncOtwTrueEmployeeAccessForUser,
} from '@/lib/otw-true';
import { validateAddress } from '@/lib/geocoding';

export const runtime = 'nodejs';

const submitSchema = z.object({
  serviceType: z.nativeEnum(ServiceType),
  pickupAddress: z.string().min(5),
  dropoffAddress: z.string().min(5),
  notes: z.string().optional(),
  scheduledStart: z.string().datetime(),
  travelMinutes: z.number().int().nonnegative(),
  waitMinutes: z.number().int().nonnegative().optional(),
  sitAndWait: z.boolean().optional(),
  numberOfStops: z.number().int().positive().optional(),
  returnOrExchange: z.boolean().optional(),
  cashHandling: z.boolean().optional(),
  peakHours: z.boolean().optional(),
  prioritySlot: z.boolean().optional(),
  preferredDriverId: z.string().min(1).optional(),
  lockToPreferred: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
  quoteToken: z.string().min(10).optional(),
  payWithMiles: z.boolean().optional(),
  paymentPreference: z.enum(['INSTANT', 'MONTHLY']).optional(),
  otwTrueBenefitType: z.enum(['FOOD_JOB_SITE', 'COMMUTE_RIDE', 'ROADSIDE_ASSIST']).optional(),
  isScheduled: z.boolean().optional(),
  scheduledFor: z.string().datetime().optional(),
  scheduleWindowMinutes: z.number().int().min(5).max(180).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const prisma = getPrisma();
    const otwTrueEntitlement = await syncOtwTrueEmployeeAccessForUser(prisma, {
      userId: user.id,
      email: user.email,
    });
    const activeSubscription = await getActiveSubscriptionUncached(user.id);
    const requestedPreference =
      parsed.data.paymentPreference ??
      (parsed.data.payWithMiles === true ? 'MONTHLY' : parsed.data.payWithMiles === false ? 'INSTANT' : undefined);
    const paymentPreference = resolveDeliveryPaymentPreferenceByPlan(
      activeSubscription?.plan,
      requestedPreference,
    );
    const overageBillingModeOverride =
      paymentPreference === 'MONTHLY' ? OverageBillingMode.INVOICE : OverageBillingMode.INSTANT;

    const scheduledStart = new Date(parsed.data.scheduledStart);
    if (Number.isNaN(scheduledStart.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledStart' }, { status: 400 });
    }
    const isScheduled = parsed.data.isScheduled === true;
    let scheduledFor: Date | null = null;
    if (isScheduled) {
      const candidate = parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : scheduledStart;
      if (Number.isNaN(candidate.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledFor' }, { status: 400 });
      }
      if (candidate.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'scheduledFor must be in the future' }, { status: 400 });
      }
      scheduledFor = candidate;
    }
    const scheduleWindowMinutes = Number.isFinite(parsed.data.scheduleWindowMinutes)
      ? Math.min(180, Math.max(5, Math.round(Number(parsed.data.scheduleWindowMinutes))))
      : DEFAULT_SCHEDULE_WINDOW_MINUTES;

    let effectiveDropoffAddress = parsed.data.dropoffAddress;
    let dropoffLocation:
      | {
          address: string;
          lat: number;
          lng: number;
          label?: string;
        }
      | undefined;

    if (parsed.data.otwTrueBenefitType === 'FOOD_JOB_SITE') {
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

    let quotedAt: Date | undefined;
    let prioritySlot = parsed.data.prioritySlot ?? false;
    let preferredDriverId = parsed.data.preferredDriverId ?? null;
    let lockToPreferred = parsed.data.lockToPreferred ?? false;
    if (parsed.data.quoteToken) {
      const payload = verifyServiceMilesQuoteToken(parsed.data.quoteToken);

      if (payload.userId !== user.id) {
        return NextResponse.json({ error: 'Quote token is not for this user' }, { status: 403 });
      }

      const tokenPrioritySlot = payload.v === 2 ? payload.prioritySlot : false;
      const tokenPreferredDriverId = payload.v === 2 ? payload.preferredDriverId : null;
      const tokenLockToPreferred = payload.v === 2 ? payload.lockToPreferred : false;

      const expectedScheduledStart = new Date(payload.scheduledStart);
      if (
        payload.serviceType !== parsed.data.serviceType ||
        expectedScheduledStart.toISOString() !== scheduledStart.toISOString() ||
        payload.travelMinutes !== parsed.data.travelMinutes ||
        payload.waitMinutes !== (parsed.data.waitMinutes ?? 0) ||
        payload.sitAndWait !== (parsed.data.sitAndWait ?? false) ||
        payload.numberOfStops !== (parsed.data.numberOfStops ?? 1) ||
        payload.returnOrExchange !== (parsed.data.returnOrExchange ?? false) ||
        payload.cashHandling !== (parsed.data.cashHandling ?? false) ||
        payload.peakHours !== (parsed.data.peakHours ?? false) ||
        tokenPrioritySlot !== (parsed.data.prioritySlot ?? false) ||
        tokenPreferredDriverId !== (parsed.data.preferredDriverId ?? null) ||
        tokenLockToPreferred !== (parsed.data.lockToPreferred ?? false)
      ) {
        return NextResponse.json({ error: 'Quote token does not match submission inputs' }, { status: 400 });
      }

      quotedAt = new Date(payload.quotedAt);
      prioritySlot = tokenPrioritySlot;
      preferredDriverId = tokenPreferredDriverId;
      lockToPreferred = tokenLockToPreferred;
      const ageMs = Date.now() - quotedAt.getTime();
      if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 20 * 60 * 1000) {
        return NextResponse.json({ error: 'Quote expired. Please re-quote.' }, { status: 409 });
      }
    }

    const result = await submitDeliveryRequest({
      userId: user.id,
      serviceType: parsed.data.serviceType,
      pickupAddress: parsed.data.pickupAddress,
      dropoffAddress: effectiveDropoffAddress,
      dropoffLocation,
      notes: parsed.data.notes,
      scheduledStart: scheduledStart,
      scheduledFor,
      isScheduled,
      scheduleWindowMinutes,
      travelMinutes: parsed.data.travelMinutes,
      waitMinutes: parsed.data.waitMinutes,
      sitAndWait: parsed.data.sitAndWait,
      numberOfStops: parsed.data.numberOfStops,
      returnOrExchange: parsed.data.returnOrExchange,
      cashHandling: parsed.data.cashHandling,
      peakHours: parsed.data.peakHours,
      prioritySlot,
      preferredDriverId: preferredDriverId ?? undefined,
      lockToPreferred,
      idempotencyKey: parsed.data.idempotencyKey,
      payWithMiles: true,
      overageBillingModeOverride,
      quotedAt,
      otwTrueBenefitType: parsed.data.otwTrueBenefitType,
    });

    const deliveryFeeCents = Number.isFinite(result.request.deliveryFeeCents)
      ? Math.max(0, Math.round(Number(result.request.deliveryFeeCents)))
      : 0;
    const deliveryPaymentRequired =
      paymentPreference !== 'MONTHLY' &&
      deliveryFeeCents > 0 &&
      result.request.deliveryFeePaid !== true;

    let deliveryPaymentIntentId = result.request.deliveryPaymentIntentId ?? null;
    let deliveryClientSecret: string | null = null;

    if (deliveryPaymentRequired) {
      try {
        const intent = await ensureDeliveryFeePaymentIntentForRequest(result.request.id);
        deliveryPaymentIntentId = intent.paymentIntentId;
        deliveryClientSecret = intent.clientSecret;
      } catch (deliveryIntentError) {
        console.error('[delivery-requests/submit] Failed to initialize delivery payment intent', {
          requestId: result.request.id,
          message:
            deliveryIntentError instanceof Error
              ? deliveryIntentError.message
              : deliveryIntentError,
        });
      }
    }

    const paymentRequired = result.paymentRequired || deliveryPaymentRequired;

    if (result.request.paymentRequired !== paymentRequired) {
      const prisma = getPrisma();
      await prisma.deliveryRequest.update({
        where: { id: result.request.id },
        data: { paymentRequired },
      });
    }

    return NextResponse.json(
      {
        id: result.request.id,
        paymentPreference,
        paymentRequired,
        deliveryPaymentRequired,
        deliveryFeeCents: result.request.deliveryFeeCents,
        deliveryPaymentIntentId,
        deliveryClientSecret,
        overageMiles: result.overageMiles,
        overageCents: result.overageCents,
        overageBillingMode: result.overageBillingMode,
        overagePaymentIntentId: result.overagePaymentIntentId,
        overageClientSecret: result.overageClientSecret,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    const normalizedMessage = message.toLowerCase();
    let status = 400;

    if (normalizedMessage.includes('unauthorized')) {
      status = 401;
    } else if (normalizedMessage.includes('forbidden')) {
      status = 403;
    } else if (normalizedMessage.includes('not found')) {
      status = 404;
    } else if (normalizedMessage.includes('expired')) {
      status = 409;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
