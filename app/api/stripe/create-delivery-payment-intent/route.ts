import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import {
  ensureDeliveryFeePaymentIntentForRequest,
  shouldRequireDeliveryFeePayment,
} from '@/lib/delivery-payment';

export const runtime = 'nodejs';

const createDeliveryIntentSchema = z.object({
  deliveryRequestId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createDeliveryIntentSchema.safeParse(body);

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
        deliveryFeeCents: true,
        deliveryFeePaid: true,
        deliveryPaymentIntentId: true,
        paymentRequired: true,
        overageBillingMode: true,
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

    if (request.deliveryFeePaid) {
      return NextResponse.json({
        alreadyPaid: true,
        paymentIntentId: request.deliveryPaymentIntentId,
      });
    }

    const amountCents = Number.isFinite(request.deliveryFeeCents)
      ? Math.max(0, Math.round(Number(request.deliveryFeeCents)))
      : 0;

    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Invalid delivery fee amount' }, { status: 400 });
    }

    const requiresPayment =
      request.paymentRequired ||
      shouldRequireDeliveryFeePayment({
        deliveryFeeCents: request.deliveryFeeCents,
        deliveryFeePaid: request.deliveryFeePaid,
        billingMode: request.overageBillingMode,
      });

    if (!requiresPayment) {
      return NextResponse.json(
        {
          error: 'Delivery fee payment is not required for this request',
        },
        { status: 409 },
      );
    }

    const paymentIntent = await ensureDeliveryFeePaymentIntentForRequest(request.id);

    return NextResponse.json({
      alreadyPaid: paymentIntent.alreadyPaid,
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId,
      amountCents: paymentIntent.amountCents,
    });
  } catch (error) {
    console.error('[CREATE_DELIVERY_PAYMENT_INTENT_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to create delivery payment intent',
      },
      { status: 500 },
    );
  }
}
