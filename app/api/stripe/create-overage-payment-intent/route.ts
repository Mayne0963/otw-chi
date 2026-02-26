import { NextResponse } from 'next/server';
import { OverageBillingMode, OverageStatus } from '@prisma/client';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { ensureOveragePaymentIntentForRequest } from '@/lib/delivery-submit';

export const runtime = 'nodejs';

const createOverageIntentSchema = z.object({
  deliveryRequestId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createOverageIntentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    const request = await prisma.deliveryRequest.findUnique({
      where: { id: parsed.data.deliveryRequestId },
      select: {
        id: true,
        userId: true,
        overageCents: true,
        overageMiles: true,
        overageBillingMode: true,
        overageStatus: true,
        paymentRequired: true,
        overagePaymentIntentId: true,
      },
    });

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const isOwner = request.userId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const amountCents = Number.isFinite(request.overageCents)
      ? Math.max(0, Math.round(Number(request.overageCents)))
      : 0;

    if (amountCents <= 0 || request.overageMiles <= 0) {
      return NextResponse.json({ error: 'No overage payment required' }, { status: 409 });
    }

    if (request.overageBillingMode !== OverageBillingMode.INSTANT) {
      return NextResponse.json({ error: 'Overage is billed on invoice for this plan' }, { status: 409 });
    }

    if (request.overageStatus === OverageStatus.PAID && !request.paymentRequired) {
      return NextResponse.json({
        alreadyPaid: true,
        paymentIntentId: request.overagePaymentIntentId,
      });
    }

    const paymentIntent = await ensureOveragePaymentIntentForRequest(request.id);

    return NextResponse.json({
      alreadyPaid: false,
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId,
      amountCents,
    });
  } catch (error) {
    console.error('[CREATE_OVERAGE_PAYMENT_INTENT_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to create overage payment intent',
      },
      { status: 500 },
    );
  }
}
