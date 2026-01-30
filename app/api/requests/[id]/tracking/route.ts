import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prisma = getPrisma();

  try {
    const [delivery, req] = await Promise.all([
      prisma.deliveryRequest.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          lastKnownLat: true,
          lastKnownLng: true,
          lastKnownAt: true,
          assignedDriver: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
      prisma.request.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          lastKnownLat: true,
          lastKnownLng: true,
          lastKnownAt: true,
          assignedDriver: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const record = delivery ?? req;

    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const driverLabel =
      record.assignedDriver?.user?.name || record.assignedDriver?.id || 'Driver';

    return NextResponse.json({
      id: record.id,
      status: record.status,
      lastKnownAt: record.lastKnownAt,
      driver: record.assignedDriver
        ? {
            id: record.assignedDriver.id,
            name: driverLabel,
            location:
              typeof record.lastKnownLat === 'number' &&
              typeof record.lastKnownLng === 'number'
                ? {
                    lat: record.lastKnownLat,
                    lng: record.lastKnownLng,
                    updatedAt: record.lastKnownAt,
                  }
                : null,
          }
        : null,
    });
  } catch (error) {
    console.error('Tracking API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
