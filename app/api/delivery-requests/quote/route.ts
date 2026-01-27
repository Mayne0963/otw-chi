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
      v: 1,
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
      quotedAt: quotedAt.toISOString(),
    });

    return NextResponse.json({ quote, quotedAt, quoteToken }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
