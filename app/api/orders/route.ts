import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { z } from 'zod';
import { Prisma, ServiceType } from '@prisma/client';

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

    if (data.serviceType === ServiceType.FOOD) {
      if (!data.deliveryFeePaid) {
        return NextResponse.json(
          { error: 'Delivery fee authorization is required for food pickup.' },
          { status: 400 }
        );
      }

      if (!data.deliveryCheckoutSessionId) {
        return NextResponse.json(
          { error: 'Delivery fee verification is required.' },
          { status: 400 }
        );
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(
        data.deliveryCheckoutSessionId
      );

      if (session.payment_status !== 'paid') {
        return NextResponse.json(
          { error: 'Delivery fee payment not completed.' },
          { status: 400 }
        );
      }

      if (
        session.metadata?.purpose !== 'delivery_fee' ||
        session.metadata?.clerkUserId !== clerkUserId
      ) {
        return NextResponse.json(
          { error: 'Delivery fee payment could not be verified.' },
          { status: 400 }
        );
      }

      if (
        typeof session.amount_total === 'number' &&
        typeof data.deliveryFeeCents === 'number' &&
        session.amount_total !== data.deliveryFeeCents
      ) {
        return NextResponse.json(
          { error: 'Delivery fee amount mismatch.' },
          { status: 400 }
        );
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
        deliveryFeeCents: data.deliveryFeeCents ?? null,
        deliveryFeePaid: data.deliveryFeePaid ?? false,
        receiptVerifiedAt: data.receiptItems?.length ? new Date() : null,
        status: 'REQUESTED',
      },
    });

    return NextResponse.json({ id: order.id });
  } catch (error) {
    console.error('Create order error:', error);
    return new NextResponse('Invalid request', { status: 400 });
  }
}
