import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import type Stripe from 'stripe';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import {
  calculateDiscount,
  findActiveCoupon,
  normalizeCouponCode,
  recordCouponRedemption,
} from '@/lib/coupons';
import { z } from 'zod';
import { Prisma, ServiceType } from '@prisma/client';
import type { PromoCode } from '@prisma/client';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function resolveStripeDiscountCents(
  stripe: Stripe,
  normalizedCode: string,
  baseTotalCents: number
): Promise<number | null> {
  const promos = await stripe.promotionCodes.list({
    code: normalizedCode,
    active: true,
    limit: 1,
  });

  const promo = promos.data[0];
  if (!promo) return null;

  const promoCoupon = (promo as unknown as { coupon?: Stripe.Coupon | string })?.coupon;
  if (!promoCoupon) return null;

  const coupon =
    typeof promoCoupon === 'string'
      ? await stripe.coupons.retrieve(promoCoupon)
      : promoCoupon;

  if (!coupon.valid) return null;
  if (coupon.amount_off && coupon.currency && coupon.currency !== 'usd') return null;

  let discount = 0;
  if (coupon.amount_off) {
    discount = Math.min(baseTotalCents, coupon.amount_off);
  } else if (coupon.percent_off) {
    discount = Math.round((baseTotalCents * coupon.percent_off) / 100);
  }

  return discount > 0 ? discount : null;
}

async function verifyDeliveryPaymentIntent(options: {
  stripe: Stripe;
  paymentIntentId: string;
  expectedAmountCents: number;
  clerkUserId: string;
  userId: string;
}) {
  const { stripe, paymentIntentId, expectedAmountCents, clerkUserId, userId } = options;

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (intent.status !== 'succeeded') {
    return { ok: false as const, error: 'Payment not completed.' };
  }

  if (intent.amount !== expectedAmountCents || intent.currency !== 'usd') {
    return { ok: false as const, error: 'Payment amount mismatch.' };
  }

  if (
    intent.metadata?.orderType !== 'delivery' ||
    intent.metadata?.clerkId !== clerkUserId ||
    intent.metadata?.userId !== userId
  ) {
    return { ok: false as const, error: 'Payment verification failed.' };
  }

  return { ok: true as const };
}

const receiptItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const orderSchema = z.object({
  serviceType: z.nativeEnum(ServiceType),
  pickupAddress: z.string().min(5),
  dropoffAddress: z.string().min(5),
  notes: z.string().optional(),
  restaurantName: z.string().min(2).optional(),
  restaurantWebsite: z.string().url().optional(),
  receiptImageData: z.string().optional(),
  receiptVendor: z.string().min(2).optional(),
  receiptLocation: z.string().optional(),
  receiptItems: z.array(receiptItemSchema).optional(),
  receiptAuthenticityScore: z.number().min(0).max(1).optional(),
  deliveryFeeCents: z.number().int().nonnegative().optional(),
  deliveryFeePaid: z.boolean().optional(),
  paymentId: z.string().optional(),
  couponCode: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    const clerkUser = await currentUser();
    if (!clerkUserId || !clerkUser) {
      return jsonError('Unauthorized', 401);
    }

    const prisma = getPrisma();
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return jsonError('Missing user email', 400);
    }

    const user = await prisma.user.upsert({
      where: { clerkId: clerkUserId },
      create: {
        clerkId: clerkUserId,
        email,
        role: 'CUSTOMER',
      },
      update: {
        email,
      },
    });

    const body = await req.json();
    const data = orderSchema.parse(body);
    const receiptSubtotalCents = data.receiptItems?.length
      ? data.receiptItems.reduce(
          (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
          0
        )
      : null;
    let appliedCouponCode: string | null = null;
    let discountCents: number | null = null;
    let appliedCoupon: PromoCode | null = null;

    if (data.serviceType === ServiceType.FOOD) {
      if (!(data.restaurantName || data.receiptVendor)) {
        return jsonError('Provide the restaurant or vendor detected on the receipt.', 400);
      }

      if (!data.receiptItems?.length) {
        return jsonError('We need the scanned receipt items to dispatch a runner.', 400);
      }
    }

    if (!data.deliveryFeePaid) {
      return jsonError('Payment authorization is required.', 400);
    }

    if (typeof data.deliveryFeeCents !== 'number') {
      return jsonError('Payment amount is required.', 400);
    }

    const computedSubtotal = receiptSubtotalCents ?? 0;
    const deliveryFeeCents = data.deliveryFeeCents ?? 0;
    const baseTotal = computedSubtotal + deliveryFeeCents;
    if (baseTotal <= 0) {
      return jsonError('Payment amount mismatch.', 400);
    }

    discountCents = 0;
    const providedCoupon = data.couponCode?.trim() ?? null;
    appliedCouponCode = providedCoupon;

    const stripe = getStripe();

    if (appliedCouponCode) {
      const normalized = normalizeCouponCode(appliedCouponCode);
      appliedCouponCode = normalized;
      const couponResult = await findActiveCoupon(prisma, normalized, user.id);
      if (couponResult) {
        const expectedDiscount = calculateDiscount(
          { subtotalCents: computedSubtotal, deliveryFeeCents },
          couponResult.coupon
        );
        if (expectedDiscount <= 0) {
          return jsonError('Invalid coupon code.', 400);
        }
        discountCents = expectedDiscount;
        appliedCoupon = couponResult.coupon;
        appliedCouponCode = couponResult.coupon.code;
      } else {
        const stripeDiscount = await resolveStripeDiscountCents(stripe, normalized, baseTotal);
        if (stripeDiscount == null) {
          return jsonError('Invalid coupon code.', 400);
        }
        discountCents = stripeDiscount;
      }
    }

    const finalTotalCents = Math.max(0, baseTotal - (discountCents ?? 0));
    const requiresStripePayment = finalTotalCents >= 50;

    if (!requiresStripePayment) {
      // Stripe can't process charges below $0.50. Allow free orders (100% discount) and
      // waive very small totals (base pricing under $0.50).
      if (finalTotalCents > 0 && baseTotal >= 50) {
        return jsonError('Total must be at least $0.50 (or free).', 400);
      }
    } else {
      if (!data.paymentId) {
        return jsonError('Payment verification is required.', 400);
      }
      const verification = await verifyDeliveryPaymentIntent({
        stripe,
        paymentIntentId: data.paymentId,
        expectedAmountCents: finalTotalCents,
        clerkUserId,
        userId: user.id,
      });
      if (!verification.ok) {
        return jsonError(verification.error, 400);
      }
    }

    const order = await prisma.deliveryRequest.create({
      data: {
        userId: user.id,
        serviceType: data.serviceType as ServiceType,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        notes: data.notes || null,
        restaurantName: data.restaurantName || null,
        restaurantWebsite: data.restaurantWebsite || null,
        receiptImageData: data.receiptImageData || null,
        receiptVendor: data.receiptVendor || data.restaurantName || null,
        receiptLocation: data.receiptLocation || null,
        receiptItems: data.receiptItems?.length ? data.receiptItems : Prisma.JsonNull,
        receiptAuthenticityScore: data.receiptAuthenticityScore ?? null,
        receiptSubtotalCents,
        deliveryFeeCents: data.deliveryFeeCents ?? null,
        deliveryFeePaid: data.deliveryFeePaid ?? false,
        deliveryCheckoutSessionId: data.paymentId ?? null,
        couponCode: appliedCouponCode,
        discountCents,
        receiptVerifiedAt: data.receiptItems?.length ? new Date() : null,
        status: 'REQUESTED',
      },
    });

    if (appliedCoupon && (discountCents ?? 0) > 0) {
      try {
        await recordCouponRedemption(prisma, appliedCoupon, user.id, order.id);
      } catch (redemptionError) {
        console.error('Coupon redemption failed:', redemptionError);
      }
    }

    try {
      await prisma.deliveryRequest.deleteMany({
        where: { userId: user.id, status: 'DRAFT' },
      });
    } catch (cleanupError) {
      console.error('Draft cleanup failed:', cleanupError);
    }

    return NextResponse.json({ id: order.id });
  } catch (error) {
    console.error('Create order error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.flatten() },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal error';
    return jsonError(process.env.NODE_ENV === 'production' ? 'Invalid request' : message, 400);
  }
}
