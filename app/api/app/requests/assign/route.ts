import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { DRIVER_ACTIVE_REQUEST_STATUSES } from '@/lib/driver-assignment';
import {
  createSystemRequestMessage,
  DRIVER_ASSIGNED_CHAT_OPEN_MESSAGE,
} from '@/lib/request-chat';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    const body = await req.json();
    const id = String(body?.id || '');
    const driverProfileId = String(body?.driverProfileId || '');
    if (!id || !driverProfileId) {
      return NextResponse.json({ success: false, error: 'Missing id or driverProfileId' }, { status: 400 });
    }

    const [request, driverProfile] = await Promise.all([
      prisma.deliveryRequest.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          paymentRequired: true,
          overageBillingMode: true,
          overageMiles: true,
          overageStatus: true,
        },
      }),
      prisma.driverProfile.findUnique({
        where: { id: driverProfileId },
        select: { id: true, userId: true },
      }),
    ]);

    if (!request) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }
    if (request.paymentRequired) {
      return NextResponse.json(
        { success: false, error: 'Request cannot be dispatched until payment is completed' },
        { status: 400 }
      );
    }
    if (
      request.overageBillingMode === 'INSTANT' &&
      request.overageMiles > 0 &&
      request.overageStatus !== 'PAID'
    ) {
      return NextResponse.json(
        { success: false, error: 'Request overage payment is not settled yet' },
        { status: 400 }
      );
    }
    if (!driverProfile) {
      return NextResponse.json({ success: false, error: 'Driver not found' }, { status: 404 });
    }
    if (request.userId === driverProfile.userId) {
      return NextResponse.json(
        { success: false, error: 'Drivers cannot accept their own requests' },
        { status: 400 }
      );
    }
    const activeRequest = await prisma.deliveryRequest.findFirst({
      where: {
        assignedDriverId: driverProfile.id,
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

    const updated = await prisma.$transaction(async (tx) => {
      const assigned = await tx.deliveryRequest.update({
        where: { id: request.id },
        data: {
          assignedDriverId: driverProfile.id,
          status: 'ASSIGNED',
          chatEnabled: true,
          chatClosedAt: null,
        },
      });

      await tx.driverAssignment.create({
        data: { deliveryRequestId: request.id, driverId: driverProfile.id },
      });

      await createSystemRequestMessage(tx, {
        deliveryRequestId: assigned.id,
        senderUserId: user.id,
        senderRole: user.role,
        messageText: DRIVER_ASSIGNED_CHAT_OPEN_MESSAGE,
      });

      return assigned;
    });
    return NextResponse.json({ success: true, request: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
