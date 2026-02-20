import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import {
  buildItemsSnapshot,
  computeTotalSnapshotDecimal,
  disputePayloadSchema,
  shouldMarkNeedsInfoForDispute,
  validateDisputedItemsAgainstSnapshot,
} from '@/lib/disputes/orderConfirmation';
import { evaluateDeliveryRequestLock } from '@/lib/refunds/lock';

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
      orderConfirmation: {
        select: {
          id: true,
          customerConfirmed: true,
          itemsSnapshot: true,
        },
      },
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

  // Check if order is locked - only allow disputes when locked
  const lockEvaluation = await evaluateDeliveryRequestLock(deliveryRequest.id);
  if (!lockEvaluation.locked) {
    return NextResponse.json({ 
      error: 'Order must be locked (receipt verified + items confirmed) before filing a dispute.' 
    }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = disputePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const currentSnapshot = deliveryRequest.orderConfirmation?.itemsSnapshot
    ? buildItemsSnapshot(deliveryRequest.orderConfirmation.itemsSnapshot)
    : buildItemsSnapshot(deliveryRequest.receiptItems);

  if (currentSnapshot.length === 0) {
    return NextResponse.json(
      {
        error: 'No confirmed items found. Confirm items before filing a dispute.',
      },
      { status: 400 }
    );
  }

  const disputedValidation = validateDisputedItemsAgainstSnapshot(
    currentSnapshot,
    parsed.data.disputedItems
  );
  if (!disputedValidation.valid) {
    return NextResponse.json(
      { error: 'Invalid disputed items', details: disputedValidation.errors },
      { status: 400 }
    );
  }

  const evidenceUrls = Array.from(new Set(parsed.data.evidenceUrls ?? []));
  const customerConfirmed = Boolean(deliveryRequest.orderConfirmation?.customerConfirmed);
  const needsInfo = shouldMarkNeedsInfoForDispute(
    customerConfirmed,
    disputedValidation.normalized,
    evidenceUrls
  );
  const disputeStatus = needsInfo ? 'NEEDS_INFO' : 'OPEN';

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

  await prisma.orderConfirmation.upsert({
    where: { deliveryRequestId: deliveryRequest.id },
    create: {
      deliveryRequestId: deliveryRequest.id,
      userId: user.id,
      itemsSnapshot: currentSnapshot as unknown as Prisma.InputJsonValue,
      totalSnapshot,
      customerConfirmed,
      confirmedAt: customerConfirmed ? new Date() : null,
      disputeStatus,
      disputedItems: disputedValidation.normalized as unknown as Prisma.InputJsonValue,
      disputeNotes: parsed.data.disputeNotes?.trim() || null,
      evidenceUrls,
      ...(latestVerificationId ? { receiptVerificationId: latestVerificationId } : {}),
    },
    update: {
      itemsSnapshot: currentSnapshot as unknown as Prisma.InputJsonValue,
      totalSnapshot,
      disputeStatus,
      disputedItems: disputedValidation.normalized as unknown as Prisma.InputJsonValue,
      disputeNotes: parsed.data.disputeNotes?.trim() || null,
      evidenceUrls,
      ...(latestVerificationId ? { receiptVerificationId: latestVerificationId } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    disputeStatus,
  });
}
