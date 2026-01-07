import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { Prisma, ServiceType } from '@prisma/client';
import { getPrisma } from '@/lib/db';

const DRAFT_STATUS = 'DRAFT' as const;

const receiptItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const draftSchema = z
  .object({
    draftId: z.string().optional(),
    serviceType: z.nativeEnum(ServiceType).optional(),
    pickupAddress: z.string().min(5).optional(),
    dropoffAddress: z.string().min(5).optional(),
    notes: z.string().optional(),
    restaurantName: z.string().optional(),
    restaurantWebsite: z.string().url().optional(),
    receiptImageData: z.string().optional(),
    receiptVendor: z.string().optional(),
    receiptLocation: z.string().optional(),
    receiptItems: z.array(receiptItemSchema).optional(),
    receiptAuthenticityScore: z.number().min(0).max(1).optional(),
    deliveryFeeCents: z.number().int().nonnegative().optional(),
    deliveryFeePaid: z.boolean().optional(),
    deliveryCheckoutSessionId: z.string().optional(),
    couponCode: z.string().optional(),
    discountCents: z.number().int().nonnegative().optional(),
  })
  .partial();

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ draft: null }, { status: 200 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
    if (!user) {
      return NextResponse.json({ draft: null }, { status: 200 });
    }

    const draft = await prisma.deliveryRequest.findFirst({
      where: { userId: user.id, status: DRAFT_STATUS },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ draft }, { status: 200 });
  } catch (error) {
    console.error('Draft fetch error:', error);
    return NextResponse.json({ draft: null }, { status: 200 });
  }
}

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
    const data = draftSchema.parse(body);

    const receiptSubtotalCents = data.receiptItems?.length
      ? data.receiptItems.reduce(
          (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
          0
        )
      : null;

    const updateData: Prisma.DeliveryRequestUpdateInput = {
      serviceType: data.serviceType,
      pickupAddress: data.pickupAddress,
      dropoffAddress: data.dropoffAddress,
      notes: data.notes ?? undefined,
      restaurantName: data.restaurantName ?? undefined,
      restaurantWebsite: data.restaurantWebsite ?? undefined,
      receiptImageData: data.receiptImageData ?? undefined,
      receiptVendor: data.receiptVendor ?? undefined,
      receiptLocation: data.receiptLocation ?? undefined,
      receiptItems:
        data.receiptItems === undefined
          ? undefined
          : data.receiptItems.length
            ? data.receiptItems
            : Prisma.JsonNull,
      receiptAuthenticityScore: data.receiptAuthenticityScore ?? undefined,
      receiptSubtotalCents:
        data.receiptItems === undefined ? undefined : receiptSubtotalCents,
      deliveryFeeCents: data.deliveryFeeCents ?? undefined,
      deliveryFeePaid: data.deliveryFeePaid ?? undefined,
      deliveryCheckoutSessionId: data.deliveryCheckoutSessionId ?? undefined,
      couponCode: data.couponCode ?? undefined,
      discountCents: data.discountCents ?? undefined,
      status: DRAFT_STATUS,
    };

    let draft = null;
    if (data.draftId) {
      draft = await prisma.deliveryRequest.findFirst({
        where: { id: data.draftId, userId: user.id, status: DRAFT_STATUS },
      });
    }

    if (!draft) {
      draft = await prisma.deliveryRequest.findFirst({
        where: { userId: user.id, status: DRAFT_STATUS },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (draft) {
      const updated = await prisma.deliveryRequest.update({
        where: { id: draft.id },
        data: updateData,
      });
      return NextResponse.json({ draftId: updated.id }, { status: 200 });
    }

    if (!data.serviceType || !data.pickupAddress || !data.dropoffAddress) {
      return NextResponse.json({ skipped: true }, { status: 200 });
    }

    const created = await prisma.deliveryRequest.create({
      data: {
        userId: user.id,
        serviceType: data.serviceType,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        notes: data.notes ?? null,
        restaurantName: data.restaurantName ?? null,
        restaurantWebsite: data.restaurantWebsite ?? null,
        receiptImageData: data.receiptImageData ?? null,
        receiptVendor: data.receiptVendor ?? null,
        receiptLocation: data.receiptLocation ?? null,
        receiptItems: data.receiptItems?.length ? data.receiptItems : Prisma.JsonNull,
        receiptAuthenticityScore: data.receiptAuthenticityScore ?? null,
        receiptSubtotalCents,
        deliveryFeeCents: data.deliveryFeeCents ?? null,
        deliveryFeePaid: data.deliveryFeePaid ?? false,
        deliveryCheckoutSessionId: data.deliveryCheckoutSessionId ?? null,
        couponCode: data.couponCode ?? null,
        discountCents: data.discountCents ?? null,
        status: DRAFT_STATUS,
      },
    });

    return NextResponse.json({ draftId: created.id }, { status: 201 });
  } catch (error) {
    console.error('Draft save error:', error);
    return new NextResponse('Invalid request', { status: 400 });
  }
}

export async function DELETE() {
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

    await prisma.deliveryRequest.deleteMany({
      where: { userId: user.id, status: DRAFT_STATUS },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Draft delete error:', error);
    return new NextResponse('Invalid request', { status: 400 });
  }
}
