export const runtime = 'nodejs';

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

const ALLOWED_EVIDENCE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
  'avif',
  'mp4',
  'mov',
  'webm',
  'm4v',
  'pdf',
]);

function isValidEvidenceReference(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol !== 'http:' &&
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 's3:'
    ) {
      return false;
    }

    const extensionMatch = parsed.pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
    if (!extensionMatch) return false;

    return ALLOWED_EVIDENCE_EXTENSIONS.has(extensionMatch[1]);
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = disputePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const disputeNotes = parsed.data.disputeNotes?.trim() ?? '';
  if (!disputeNotes) {
    return NextResponse.json({ error: 'Must provide a reason for the dispute.' }, { status: 400 });
  }

  const evidenceUrls = Array.from(
    new Set(
      (parsed.data.evidenceUrls ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  const invalidEvidenceUrls = evidenceUrls.filter((url) => !isValidEvidenceReference(url));
  if (invalidEvidenceUrls.length > 0) {
    return NextResponse.json(
      {
        error:
          'Invalid evidence URL format. Only image, video, and PDF references are allowed.',
      },
      { status: 400 }
    );
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

  const lockEvaluation = await evaluateDeliveryRequestLock(id);
  if (lockEvaluation.locked && evidenceUrls.length === 0) {
    return NextResponse.json(
      { error: 'Must provide evidence for a locked order dispute.' },
      { status: 400 }
    );
  }

  const currentSnapshot = deliveryRequest.orderConfirmation?.itemsSnapshot
    ? buildItemsSnapshot(deliveryRequest.orderConfirmation.itemsSnapshot)
    : buildItemsSnapshot(deliveryRequest.receiptItems);

  let normalizedDisputedItems: ReturnType<typeof validateDisputedItemsAgainstSnapshot>['normalized'] = [];
  if (parsed.data.disputedItems.length > 0) {
    if (currentSnapshot.length === 0) {
      return NextResponse.json(
        {
          error: 'No confirmed items found. Confirm items before filing an item-specific dispute.',
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

    normalizedDisputedItems = disputedValidation.normalized;
  }

  const customerConfirmed = Boolean(deliveryRequest.orderConfirmation?.customerConfirmed);
  const needsInfo = shouldMarkNeedsInfoForDispute(
    customerConfirmed,
    normalizedDisputedItems,
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
      disputedItems: normalizedDisputedItems as unknown as Prisma.InputJsonValue,
      disputeNotes,
      evidenceUrls,
      ...(latestVerificationId ? { receiptVerificationId: latestVerificationId } : {}),
    },
    update: {
      itemsSnapshot: currentSnapshot as unknown as Prisma.InputJsonValue,
      totalSnapshot,
      disputeStatus,
      disputedItems: normalizedDisputedItems as unknown as Prisma.InputJsonValue,
      disputeNotes,
      evidenceUrls,
      ...(latestVerificationId ? { receiptVerificationId: latestVerificationId } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    disputeStatus,
  });
}
