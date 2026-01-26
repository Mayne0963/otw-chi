import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ServiceType } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/roles';
import { submitDeliveryRequest } from '@/lib/delivery-submit';

const submitSchema = z.object({
  serviceType: z.nativeEnum(ServiceType),
  pickupAddress: z.string().min(5),
  dropoffAddress: z.string().min(5),
  notes: z.string().optional(),
  scheduledStart: z.string().datetime(),
  travelMinutes: z.number().int().nonnegative(),
  waitMinutes: z.number().int().nonnegative().optional(),
  numberOfStops: z.number().int().positive().optional(),
  returnOrExchange: z.boolean().optional(),
  cashHandling: z.boolean().optional(),
  peakHours: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
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

    const request = await submitDeliveryRequest({
      userId: user.id,
      serviceType: parsed.data.serviceType,
      pickupAddress: parsed.data.pickupAddress,
      dropoffAddress: parsed.data.dropoffAddress,
      notes: parsed.data.notes,
      scheduledStart,
      travelMinutes: parsed.data.travelMinutes,
      waitMinutes: parsed.data.waitMinutes,
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

