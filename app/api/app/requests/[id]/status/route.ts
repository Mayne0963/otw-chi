import { NextResponse, NextRequest } from 'next/server';
import { DeliveryRequestStatus, Role } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { DRIVER_ACTIVE_REQUEST_STATUSES } from '@/lib/driver-assignment';
import {
  DISPATCH_PAYMENT_REQUIRED_ERROR,
  isDispatchBlockedByPayment,
} from '@/lib/request-payment';
import {
  createSystemRequestMessage,
  DELIVERED_CHAT_CLOSED_MESSAGE,
  DRIVER_ASSIGNED_CHAT_OPEN_MESSAGE,
} from '@/lib/request-chat';

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
    const actor = await getCurrentUser();
    const { id } = await ctx.params;
    const body = await req.json();
    const nextStatus = String(body?.status || '').toUpperCase();
    if (!nextStatus) {
      return NextResponse.json({ success: false, error: 'Missing status' }, { status: 400 });
    }

    const request = await prisma.deliveryRequest.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        assignedDriverId: true,
        status: true,
        paymentRequired: true,
        deliveryFeePaid: true,
        deliveryFeeCents: true,
        overageBillingMode: true,
        overageMiles: true,
        overageStatus: true,
        chatClosedAt: true,
        assignedDriver: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const from = request.status as DeliveryRequestStatus;
    const to = nextStatus as DeliveryRequestStatus;
    if (!canTransition(from, to)) {
      return NextResponse.json({ success: false, error: `Invalid transition ${from} -> ${to}` }, { status: 400 });
    }
    if (to === DeliveryRequestStatus.ASSIGNED && isDispatchBlockedByPayment(request)) {
      return NextResponse.json(
        { success: false, error: DISPATCH_PAYMENT_REQUIRED_ERROR },
        { status: 409 }
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

    const now = new Date();
    const updated = await prisma.deliveryRequest.update({
      where: { id },
      data: {
        status: to,
        ...(to === DeliveryRequestStatus.ASSIGNED
          ? {
              chatEnabled: true,
              chatClosedAt: null,
            }
          : {}),
        ...(to === DeliveryRequestStatus.DELIVERED || to === DeliveryRequestStatus.CANCELED
          ? {
              chatEnabled: false,
              chatClosedAt: request.chatClosedAt ?? now,
            }
          : {}),
      },
    });

    if (to === DeliveryRequestStatus.ASSIGNED && actor) {
      await createSystemRequestMessage(prisma, {
        deliveryRequestId: request.id,
        senderUserId: actor.id,
        senderRole: actor.role,
        messageText: DRIVER_ASSIGNED_CHAT_OPEN_MESSAGE,
      });
    }

    if (
      (to === DeliveryRequestStatus.DELIVERED || to === DeliveryRequestStatus.CANCELED) &&
      !request.chatClosedAt
    ) {
      const fallbackSenderUserId = request.assignedDriver?.userId ?? request.userId;
      const senderUserId = actor?.id ?? fallbackSenderUserId;
      const senderRole = actor?.role
        ?? (request.assignedDriver?.userId === senderUserId ? Role.DRIVER : Role.CUSTOMER);

      await createSystemRequestMessage(prisma, {
        deliveryRequestId: request.id,
        senderUserId,
        senderRole,
        messageText: DELIVERED_CHAT_CLOSED_MESSAGE,
      });
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
