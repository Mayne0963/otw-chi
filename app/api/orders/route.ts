import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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
  deliveryCheckoutSessionId: z.string().optional(),
  couponCode: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

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
      if (!data.deliveryFeePaid) {
        return NextResponse.json(
          { error: 'Payment authorization is required for food pickup.' },
          { status: 400 }
        );
      }

      if (typeof data.deliveryFeeCents !== 'number') {
        return NextResponse.json(
          { error: 'Payment amount is required.' },
          { status: 400 }
        );
      }

      if (!data.deliveryCheckoutSessionId) {
        return NextResponse.json(
          { error: 'Payment verification is required.' },
          { status: 400 }
        );
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(
        data.deliveryCheckoutSessionId
      );

      if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        return NextResponse.json(
          { error: 'Payment not completed.' },
          { status: 400 }
        );
      }

      if (
        session.metadata?.purpose !== 'order_payment' ||
        session.metadata?.clerkUserId !== clerkUserId
      ) {
        return NextResponse.json(
          { error: 'Payment could not be verified.' },
          { status: 400 }
        );
      }

      const computedSubtotal = receiptSubtotalCents ?? 0;
      const deliveryFeeCents = data.deliveryFeeCents ?? 0;
      const baseTotal = computedSubtotal + deliveryFeeCents;
      const sessionTotal = session.amount_total ?? null;

      if (baseTotal <= 0 || sessionTotal === null) {
        return NextResponse.json(
          { error: 'Payment amount mismatch.' },
          { status: 400 }
        );
      }

      if (session.metadata?.deliveryFeeCents) {
        const metaDeliveryFee = Number(session.metadata.deliveryFeeCents);
        if (Number.isFinite(metaDeliveryFee) && metaDeliveryFee !== deliveryFeeCents) {
          return NextResponse.json(
            { error: 'Payment amount mismatch.' },
            { status: 400 }
          );
        }
      }

      if (session.metadata?.subtotalCents) {
        const metaSubtotal = Number(session.metadata.subtotalCents);
        if (Number.isFinite(metaSubtotal) && metaSubtotal !== computedSubtotal) {
          return NextResponse.json(
            { error: 'Receipt subtotal mismatch.' },
            { status: 400 }
          );
        }
      }

      if (sessionTotal > baseTotal) {
        return NextResponse.json(
          { error: 'Payment amount mismatch.' },
          { status: 400 }
        );
      }

      discountCents = Math.max(0, baseTotal - sessionTotal);
      const sessionCoupon = session.metadata?.couponCode?.trim();
      const providedCoupon = data.couponCode?.trim() ?? null;
      const couponSource = session.metadata?.couponSource;
      appliedCouponCode =
        sessionCoupon || (couponSource === 'internal' ? providedCoupon : null);

      if (appliedCouponCode && couponSource === 'internal') {
        const normalized = normalizeCouponCode(appliedCouponCode);
        const couponResult = await findActiveCoupon(prisma, normalized, user.id);
        if (couponResult) {
          const expectedDiscount = calculateDiscount(
            { subtotalCents: computedSubtotal, deliveryFeeCents },
            couponResult.coupon
          );
          if (expectedDiscount !== discountCents) {
            return NextResponse.json(
              { error: 'Coupon discount mismatch.' },
              { status: 400 }
            );
          }
          appliedCoupon = couponResult.coupon;
        } else {
          return NextResponse.json(
            { error: 'Coupon discount mismatch.' },
            { status: 400 }
          );
        }
      }

      if (!(data.restaurantName || data.receiptVendor)) {
        return NextResponse.json(
          { error: 'Provide the restaurant or vendor detected on the receipt.' },
          { status: 400 }
        );
      }

      if (!data.receiptItems?.length) {
        return NextResponse.json(
          { error: 'We need the scanned receipt items to dispatch a runner.' },
          { status: 400 }
        );
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
    return new NextResponse('Invalid request', { status: 400 });
  }
}
