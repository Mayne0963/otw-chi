import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import {
  buildItemsSnapshot,
  computeTotalSnapshotDecimal,
  confirmPayloadSchema,
} from '@/lib/disputes/orderConfirmation';
import { evaluateDeliveryRequestLock, applyDeliveryRequestLock } from '@/lib/refunds/lock';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const prisma = getPrisma();

  const deliveryRequest = await prisma.deliveryRequest.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      serviceType: true,
      receiptItems: true,
      receiptSubtotalCents: true,
      deliveryFeeCents: true,
      receiptImageData: true,
      quoteBreakdown: true,
      discountCents: true,
      receiptVerifications: {
        where: { status: { in: ['APPROVED', 'FLAGGED'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!deliveryRequest || deliveryRequest.userId !== user.id) {
    return NextResponse.json({ error: 'Delivery request not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = confirmPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const snapshot = parsed.data.itemsSnapshot
    ? buildItemsSnapshot(parsed.data.itemsSnapshot)
    : buildItemsSnapshot(deliveryRequest.receiptItems);

  if (snapshot.length === 0) {
    return NextResponse.json(
      { error: 'No source items found to confirm. Please upload or add items first.' },
      { status: 400 }
    );
  }

  const totalSnapshot = computeTotalSnapshotDecimal({
    serviceType: deliveryRequest.serviceType,
    receiptSubtotalCents: deliveryRequest.receiptSubtotalCents,
    deliveryFeeCents: deliveryRequest.deliveryFeeCents,
    receiptImageData: deliveryRequest.receiptImageData,
    receiptItems: deliveryRequest.receiptItems,
    quoteBreakdown: deliveryRequest.quoteBreakdown,
    discountCents: deliveryRequest.discountCents,
  });

  const latestVerificationId = deliveryRequest.receiptVerifications[0]?.id ?? null;

  const confirmation = await prisma.orderConfirmation.upsert({
    where: { deliveryRequestId: deliveryRequest.id },
    create: {
      deliveryRequestId: deliveryRequest.id,
      userId: user.id,
      itemsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      totalSnapshot,
      customerConfirmed: true,
      confirmedAt: new Date(),
      ...(latestVerificationId ? { receiptVerificationId: latestVerificationId } : {}),
    },
    update: {
      userId: user.id,
      itemsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      totalSnapshot,
      customerConfirmed: true,
      confirmedAt: new Date(),
      ...(latestVerificationId ? { receiptVerificationId: latestVerificationId } : {}),
    },
    select: { id: true },
  });

  // After successful confirmation, evaluate and apply lock if needed
  const lockEvaluation = await evaluateDeliveryRequestLock(deliveryRequest.id);
  if (lockEvaluation.locked) {
    await applyDeliveryRequestLock(deliveryRequest.id, user.id);
  }

  return NextResponse.json({
    ok: true,
    confirmationId: confirmation.id,
  });
}
