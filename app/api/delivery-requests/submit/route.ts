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
  idempotencyKey: z.string().min(8).max(200).optional(),
  quoteToken: z.string().min(10).optional(),
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
    if (parsed.data.quoteToken) {
      const payload = verifyServiceMilesQuoteToken(parsed.data.quoteToken);

      if (payload.userId !== user.id) {
        return NextResponse.json({ error: 'Quote token is not for this user' }, { status: 403 });
      }

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
        payload.peakHours !== (parsed.data.peakHours ?? false)
      ) {
        return NextResponse.json({ error: 'Quote token does not match submission inputs' }, { status: 400 });
      }

      quotedAt = new Date(payload.quotedAt);
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
      scheduledStart,
      travelMinutes: parsed.data.travelMinutes,
      quotedAt,
      waitMinutes: parsed.data.waitMinutes,
      sitAndWait: parsed.data.sitAndWait,
      numberOfStops: parsed.data.numberOfStops,
      returnOrExchange: parsed.data.returnOrExchange,
      cashHandling: parsed.data.cashHandling,
      peakHours: parsed.data.peakHours,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    return NextResponse.json({ id: request.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    const status = /Unauthorized|not found/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
