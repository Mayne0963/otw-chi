import { NextResponse } from 'next/server';
import { getNeonSession } from '@/lib/neon-server';
import { getPrisma } from '@/lib/db';
import { ADMIN_FREE_COUPON_CODE, isAdminFreeCoupon } from '@/lib/admin-discount';
import { z } from 'zod';
import { Prisma, ServiceType } from '@prisma/client';
import { submitDeliveryRequest } from '@/lib/delivery-submit';

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
  tipCents: z.number().int().nonnegative().optional(),
  payWithMiles: z.boolean().optional(),
  travelMinutes: z.number().nonnegative().optional(),
  waitMinutes: z.number().int().min(10).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getNeonSession();
    // @ts-ignore
    const clerkUserId = session?.userId || session?.user?.id;

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

    if (data.serviceType === ServiceType.FOOD) {
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

    // --- "Pay with Miles" Flow ---
    if (data.payWithMiles) {
      if (typeof data.travelMinutes !== 'number') {
        return NextResponse.json(
          { error: 'Travel duration is required for miles payment.' },
          { status: 400 }
        );
      }

      try {
        const result = await submitDeliveryRequest({
          userId: user.id,
          serviceType: data.serviceType,
          pickupAddress: data.pickupAddress,
          dropoffAddress: data.dropoffAddress,
          notes: data.notes,
          travelMinutes: data.travelMinutes,
          waitMinutes: data.waitMinutes,
          scheduledStart: new Date(), // Immediate
          payWithMiles: true,
          
          // Pass optional fields
          restaurantName: data.restaurantName,
          restaurantWebsite: data.restaurantWebsite,
          receiptImageData: data.receiptImageData,
          receiptVendor: data.receiptVendor,
          receiptLocation: data.receiptLocation,
          receiptItems: data.receiptItems?.length ? (data.receiptItems as Prisma.InputJsonValue) : undefined,
          receiptAuthenticityScore: data.receiptAuthenticityScore,
          deliveryFeeCents: data.deliveryFeeCents,
          tipCents: data.tipCents,
          couponCode: data.couponCode,
        });

        // Cleanup draft
        try {
            await prisma.deliveryRequest.deleteMany({
              where: { userId: user.id, status: 'DRAFT' },
            });
        } catch (cleanupError) {
            console.error('Draft cleanup failed:', cleanupError);
        }

        return NextResponse.json({ id: result.id });

      } catch (error) {
        console.error('Submit delivery (miles) error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to process miles payment' },
          { status: 400 }
        );
      }
    }

    // --- Standard Stripe Flow ---

    if (!data.deliveryFeePaid) {
      return NextResponse.json(
        { error: 'Payment authorization is required.' },
        { status: 400 }
      );
    }

    if (typeof data.deliveryFeeCents !== 'number') {
      return NextResponse.json(
        { error: 'Payment amount is required.' },
        { status: 400 }
      );
    }

    if (!data.paymentId) {
      return NextResponse.json(
        { error: 'Payment verification is required.' },
        { status: 400 }
      );
    }

    const computedSubtotal = receiptSubtotalCents ?? 0;
    const deliveryFeeCents = data.deliveryFeeCents ?? 0;
    const baseTotal = computedSubtotal + deliveryFeeCents;
    const tipCents = data.tipCents ?? 0;
    const sessionTotal = baseTotal + tipCents;

    if (baseTotal <= 0 || sessionTotal <= 0) {
      return NextResponse.json(
        { error: 'Payment amount mismatch.' },
        { status: 400 }
      );
    }

    discountCents = 0;
    const providedCoupon = data.couponCode?.trim() ?? null;
    appliedCouponCode = providedCoupon;

    if (appliedCouponCode) {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (!isAdminFreeCoupon(appliedCouponCode)) {
        return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
      }

      appliedCouponCode = ADMIN_FREE_COUPON_CODE;
      discountCents = baseTotal;
    }

    const finalTotal = Math.max(0, baseTotal - (discountCents ?? 0)) + tipCents;
    if (data.paymentId === 'free_order' && finalTotal !== 0) {
      return NextResponse.json({ error: 'Payment verification is required.' }, { status: 400 });
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
        tipCents,
        receiptVerifiedAt: data.receiptItems?.length ? new Date() : null,
        status: 'REQUESTED',
        waitMinutes: data.waitMinutes ?? 10,
      },
    });

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
        return NextResponse.json({ error: 'Validation failed', details: error.flatten() }, { status: 400 });
    }
    return new NextResponse('Invalid request', { status: 400 });
  }
}
