import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

export const revalidate = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const limit = rateLimit({ key: `tracking:${ip}`, intervalMs: 10000, max: 1 });
  
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait.', retryAfter: Math.ceil(limit.retryAfterMs / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }

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
