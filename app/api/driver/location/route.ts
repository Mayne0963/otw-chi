import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';

const locationSchema = z.object({
  requestId: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = user.publicMetadata.role as string;
    if (role !== 'DRIVER' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Driver access required' }, { status: 403 });
    }

    const body = await req.json();
    const result = locationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 });
    }

    const { requestId, lat, lng } = result.data;
    const prisma = getPrisma();

    // Verify driver is assigned to this request
    const dbUser = await prisma.user.findUnique({ where: { clerkId: user.id } });
    if (!dbUser) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { assignedDriver: true }
    });

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (request.assignedDriver?.userId !== dbUser.id && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not assigned to this request' }, { status: 403 });
    }

    // Update location
    const updated = await prisma.request.update({
      where: { id: requestId },
      data: {
        lastKnownLat: lat,
        lastKnownLng: lng,
        lastKnownAt: new Date(),
      },
    });

    if (request.assignedDriver?.id) {
      await prisma.driverLocation.create({
        data: {
          driverId: request.assignedDriver.id,
          lat,
          lng,
        }
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update location error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
