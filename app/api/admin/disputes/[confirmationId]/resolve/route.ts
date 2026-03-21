export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/roles';

const resolvePayloadSchema = z.object({
  resolution: z.enum(['APPROVED', 'DENIED', 'NEEDS_INFO']),
  notes: z.string().trim().max(5000).optional(),
  refundAmount: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d{1,2})?$/)]).optional(),
});

function normalizeRefundAmount(value: number | string | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'number') return value.toFixed(2);
  return Number(value).toFixed(2);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ confirmationId: string }> }
) {
  let adminUser: Awaited<ReturnType<typeof requireRole>>;
  try {
    adminUser = await requireRole(['ADMIN']);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  const { confirmationId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = resolvePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrisma();
  const confirmation = await prisma.orderConfirmation.findUnique({
    where: { id: confirmationId },
    select: {
      id: true,
      deliveryRequestId: true,
      deliveryRequest: {
        select: {
          isLocked: true,
        },
      },
    },
  });

  if (!confirmation) {
    return NextResponse.json({ error: 'Order confirmation not found' }, { status: 404 });
  }

  const resolution = parsed.data.resolution;
  const notes = parsed.data.notes?.trim() ?? '';
  const refundAmount = normalizeRefundAmount(parsed.data.refundAmount);

  if (resolution === 'NEEDS_INFO' && !notes) {
    return NextResponse.json(
      { error: 'Provide notes so the customer knows what information is needed.' },
      { status: 400 }
    );
  }

  if (resolution === 'APPROVED') {
    if (refundAmount == null || Number(refundAmount) <= 0) {
      return NextResponse.json(
        { error: 'Refund amount is required for approval.' },
        { status: 400 }
      );
    }
  }

  const mappedStatus =
    resolution === 'APPROVED'
      ? 'RESOLVED_APPROVED'
      : resolution === 'DENIED'
        ? 'RESOLVED_DENIED'
        : 'NEEDS_INFO';

  const updated = await prisma.orderConfirmation.update({
    where: { id: confirmationId },
    data: {
      disputeStatus: mappedStatus,
      resolutionNotes: notes || null,
      refundAmount: resolution === 'APPROVED' ? refundAmount : null,
      resolvedAt: resolution === 'NEEDS_INFO' ? null : new Date(),
      resolvedByUserId: resolution === 'NEEDS_INFO' ? null : adminUser.id,
    },
    select: {
      id: true,
      disputeStatus: true,
      resolutionNotes: true,
      refundAmount: true,
      resolvedAt: true,
      resolvedByUserId: true,
    },
  });

  return NextResponse.json({
    ok: true,
    confirmationId: updated.id,
    disputeStatus: updated.disputeStatus,
    requestLocked: confirmation.deliveryRequest.isLocked,
  });
}
