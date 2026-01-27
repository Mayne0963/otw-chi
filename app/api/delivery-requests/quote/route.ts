import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ServiceType } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { calculateServiceMiles } from '@/lib/service-miles';
import { isServiceTypeAllowedForPlan } from '@/lib/service-miles-access';
import { signServiceMilesQuoteToken } from '@/lib/service-miles-quote-token';

const quoteSchema = z.object({
  serviceType: z.nativeEnum(ServiceType),
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
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = quoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const scheduledStart = new Date(parsed.data.scheduledStart);
    if (Number.isNaN(scheduledStart.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledStart' }, { status: 400 });
    }

    const prisma = getPrisma();
    const membership = await prisma.membershipSubscription.findUnique({
      where: { userId: user.id },
      include: { plan: true },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Active membership required' }, { status: 403 });
    }

    const plan = membership.plan;
    if (!plan) {
      return NextResponse.json({ error: 'Membership plan not found' }, { status: 400 });
    }

    const prioritySlot = parsed.data.prioritySlot ?? false;
    const preferredDriverId = parsed.data.preferredDriverId ?? null;
    const lockToPreferred = parsed.data.lockToPreferred ?? false;
    const eligibleForPriority = plan.name.toUpperCase().includes('OTW ELITE') || plan.name.toUpperCase().includes('OTW BLACK');

    if (!eligibleForPriority && (prioritySlot || preferredDriverId || lockToPreferred)) {
      return NextResponse.json({ error: 'Priority scheduling is not enabled for this plan' }, { status: 403 });
    }
    if (lockToPreferred && !preferredDriverId) {
      return NextResponse.json({ error: 'Preferred driver is required when locking' }, { status: 400 });
    }
    if (preferredDriverId) {
      const exists = await prisma.driverProfile.findUnique({ where: { id: preferredDriverId }, select: { id: true } });
      if (!exists) {
        return NextResponse.json({ error: 'Preferred driver not found' }, { status: 400 });
      }
    }

    if (!isServiceTypeAllowedForPlan(plan.allowedServiceTypes, parsed.data.serviceType)) {
      return NextResponse.json(
        { error: `Service type ${parsed.data.serviceType} not allowed for this plan` },
        { status: 403 }
      );
    }

    if (parsed.data.cashHandling && !plan.cashAllowed) {
      return NextResponse.json({ error: 'Cash handling is not allowed for this plan' }, { status: 403 });
    }

    const quotedAt = new Date();
    const quote = calculateServiceMiles({
      travelMinutes: parsed.data.travelMinutes,
      serviceType: parsed.data.serviceType,
      scheduledStart,
      quotedAt,
      waitMinutes: parsed.data.waitMinutes,
      sitAndWait: parsed.data.sitAndWait,
      numberOfStops: parsed.data.numberOfStops,
      returnOrExchange: parsed.data.returnOrExchange,
      cashHandling: parsed.data.cashHandling,
      peakHours: parsed.data.peakHours,
      advanceDiscountMax: plan.advanceDiscountMax,
    });

    const quoteToken = signServiceMilesQuoteToken({
      v: 2,
      userId: user.id,
      serviceType: parsed.data.serviceType,
      scheduledStart: scheduledStart.toISOString(),
      travelMinutes: parsed.data.travelMinutes,
      waitMinutes: parsed.data.waitMinutes ?? 0,
      sitAndWait: parsed.data.sitAndWait ?? false,
      numberOfStops: parsed.data.numberOfStops ?? 1,
      returnOrExchange: parsed.data.returnOrExchange ?? false,
      cashHandling: parsed.data.cashHandling ?? false,
      peakHours: parsed.data.peakHours ?? false,
      advanceDiscountMax: plan.advanceDiscountMax,
      prioritySlot,
      preferredDriverId,
      lockToPreferred,
      quotedAt: quotedAt.toISOString(),
    });

    return NextResponse.json({ quote, quotedAt, quoteToken }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
