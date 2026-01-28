import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ServiceType } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/roles';
import { submitDeliveryRequest } from '@/lib/delivery-submit';
import { verifyServiceMilesQuoteToken } from '@/lib/service-miles-quote-token';

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

    const scheduledStart = new Date(parsed.data.scheduledStart);
    if (Number.isNaN(scheduledStart.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledStart' }, { status: 400 });
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

    const request = await submitDeliveryRequest({
      userId: user.id,
      serviceType: parsed.data.serviceType,
      pickupAddress: parsed.data.pickupAddress,
      dropoffAddress: parsed.data.dropoffAddress,
      notes: parsed.data.notes,
      scheduledStart: scheduledStart,
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
      payWithMiles: parsed.data.payWithMiles,
      quotedAt,
    });

    return NextResponse.json({ id: request.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    const status = /Unauthorized|not found/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
