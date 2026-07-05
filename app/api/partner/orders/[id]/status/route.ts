import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { isAuthorizedPartnerRequest } from '@/lib/partner-auth';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedPartnerRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const prisma = getPrisma();

  const request = await prisma.deliveryRequest.findUnique({
    where: { id },
    include: { assignedDriver: { include: { user: true } } },
  });

  if (!request) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const driver = request.assignedDriver;
  const driverInfo = driver
    ? {
        name: driver.user?.name || 'OTW Driver',
        phone: '',
        vehicle: '',
      }
    : undefined;

  const driverLocation =
    typeof request.lastKnownLat === 'number' && typeof request.lastKnownLng === 'number'
      ? { lat: request.lastKnownLat, lng: request.lastKnownLng }
      : undefined;

  return NextResponse.json({
    status: request.status,
    driver_location: driverLocation,
    estimated_arrival: request.scheduledFor?.toISOString(),
    driver_info: driverInfo,
  });
}
