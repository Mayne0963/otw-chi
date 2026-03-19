export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { serverFeatureFlags } from '@/lib/featureFlags';
import { DeliveryRequestStatus, Role } from '@prisma/client';
import {
  isPickupPassExpired,
  purgeExpiredPickupPassForRequest,
  toPickupPassDataUrl,
} from '@/lib/pickup-pass';
import { isRequestParticipant } from '@/lib/request-chat';
import { getSignedUrlForObjectRef } from '@/lib/storage';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!serverFeatureFlags.pickupPass) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const prisma = getPrisma();
  const driverProfile =
    user.role === Role.DRIVER
      ? await prisma.driverProfile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        })
      : null;
  const request = await prisma.deliveryRequest.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      assignedDriverId: true,
      status: true,
      chatEnabled: true,
      chatClosedAt: true,
      pickupPassImageUrl: true,
      pickupPassBase64: true,
      pickupPassMimeType: true,
      pickupPassExpiresAt: true,
      assignedDriver: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  const isAssignedDriverViewer = Boolean(
    driverProfile?.id &&
      request.assignedDriverId === driverProfile.id
  );

  const isOpenMarketDriverViewer = Boolean(
    user.role === Role.DRIVER &&
      request.status === DeliveryRequestStatus.REQUESTED &&
      request.assignedDriverId === null
  );

  if (
    !isAssignedDriverViewer &&
    !isOpenMarketDriverViewer &&
    !isRequestParticipant(request, { id: user.id, role: user.role })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!request.pickupPassImageUrl && !request.pickupPassBase64) {
    return NextResponse.json({ error: 'Pickup pass not found' }, { status: 404 });
  }

  const now = new Date();
  if (isPickupPassExpired(request.pickupPassExpiresAt, now)) {
    if (request.pickupPassBase64) {
      await purgeExpiredPickupPassForRequest(prisma, request.id, now);
    }
    return NextResponse.json({ error: 'Pickup pass has expired' }, { status: 410 });
  }

  if (request.pickupPassImageUrl) {
    const signedUrl = await getSignedUrlForObjectRef(request.pickupPassImageUrl, 900);
    if (!signedUrl) {
      return NextResponse.json({ error: 'Pickup pass is unavailable' }, { status: 404 });
    }

    return NextResponse.json({
      pickupPassUrl: signedUrl,
      pickupPassExpiresAt: request.pickupPassExpiresAt,
    });
  }

  if (!request.pickupPassBase64) {
    return NextResponse.json({ error: 'Pickup pass is unavailable' }, { status: 404 });
  }

  return NextResponse.json({
    pickupPassUrl: toPickupPassDataUrl(request.pickupPassBase64, request.pickupPassMimeType),
    pickupPassExpiresAt: request.pickupPassExpiresAt,
  });
}
