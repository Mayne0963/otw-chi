import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from '@/lib/db';
import { DeliveryRequestStatus } from '@prisma/client';
import { DRIVER_ACTIVE_REQUEST_STATUSES } from '@/lib/driver-assignment';

const allowed: Record<DeliveryRequestStatus, DeliveryRequestStatus[]> = {
  DRAFT: ['REQUESTED', 'CANCELED'],
  REQUESTED: ['ASSIGNED', 'CANCELED'],
  ASSIGNED: ['PICKED_UP', 'CANCELED'],
  PICKED_UP: ['EN_ROUTE', 'CANCELED'],
  EN_ROUTE: ['DELIVERED', 'CANCELED'],
  DELIVERED: [],
  CANCELED: [],
};

export function canTransition(from: DeliveryRequestStatus, to: DeliveryRequestStatus) {
  return allowed[from]?.includes(to) ?? false;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const prisma = getPrisma();
    const { id } = await ctx.params;
    const body = await req.json();
    const nextStatus = String(body?.status || '').toUpperCase();
    if (!nextStatus) {
      return NextResponse.json({ success: false, error: 'Missing status' }, { status: 400 });
    }
    const request = await prisma.deliveryRequest.findUnique({ where: { id } });
    if (!request) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    const from = request.status as DeliveryRequestStatus;
    const to = nextStatus as DeliveryRequestStatus;
    if (!canTransition(from, to)) {
      return NextResponse.json({ success: false, error: `Invalid transition ${from} -> ${to}` }, { status: 400 });
    }
    if (to === DeliveryRequestStatus.ASSIGNED && request.paymentRequired) {
      return NextResponse.json(
        { success: false, error: 'Request cannot be dispatched until payment is completed' },
        { status: 400 }
      );
    }
    if (
      to === DeliveryRequestStatus.ASSIGNED &&
      request.overageBillingMode === 'INSTANT' &&
      request.overageMiles > 0 &&
      request.overageStatus !== 'PAID'
    ) {
      return NextResponse.json(
        { success: false, error: 'Request overage payment is not settled yet' },
        { status: 400 }
      );
    }
    if (to === DeliveryRequestStatus.ASSIGNED && request.assignedDriverId) {
      const activeRequest = await prisma.deliveryRequest.findFirst({
        where: {
          assignedDriverId: request.assignedDriverId,
          status: { in: DRIVER_ACTIVE_REQUEST_STATUSES },
          id: { not: request.id },
        },
        select: { id: true },
      });
      if (activeRequest) {
        return NextResponse.json(
          { success: false, error: 'Driver already has an active request' },
          { status: 400 }
        );
      }
    }
    const updated = await prisma.deliveryRequest.update({
      where: { id },
      data: { status: to },
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
