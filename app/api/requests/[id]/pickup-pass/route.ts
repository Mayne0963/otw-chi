import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { serverFeatureFlags } from '@/lib/featureFlags';
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

  if (!isRequestParticipant(request, { id: user.id, role: user.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!request.pickupPassImageUrl) {
    return NextResponse.json({ error: 'Pickup pass not found' }, { status: 404 });
  }

  if (request.pickupPassExpiresAt && new Date() > request.pickupPassExpiresAt) {
    return NextResponse.json({ error: 'Pickup pass has expired' }, { status: 410 });
  }

  const signedUrl = await getSignedUrlForObjectRef(request.pickupPassImageUrl, 900);
  if (!signedUrl) {
    return NextResponse.json({ error: 'Pickup pass is unavailable' }, { status: 404 });
  }

  return NextResponse.json({
    pickupPassUrl: signedUrl,
    pickupPassExpiresAt: request.pickupPassExpiresAt,
  });
}
