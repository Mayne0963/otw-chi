import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';

const pingSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ 
        where: { clerkId: userId },
        include: { driverProfile: true }
    });

    if (!user || !user.driverProfile) {
        return new NextResponse('Driver profile not found', { status: 404 });
    }

    const body = await req.json();
    const { lat, lng } = pingSchema.parse(body);

    // Find active delivery request first
    const activeDelivery = await prisma.deliveryRequest.findFirst({
      where: {
        assignedDriverId: user.driverProfile.id,
        status: { in: ['ASSIGNED', 'PICKED_UP', 'EN_ROUTE'] },
      },
    });

    const activeRequest = activeDelivery
      ? null
      : await prisma.request.findFirst({
          where: {
            assignedDriverId: user.driverProfile.id,
            status: { in: ['ASSIGNED', 'PICKED_UP', 'EN_ROUTE'] },
          },
        });

    // Save Ping
    await prisma.driverLocationPing.create({
        data: {
            driverId: user.driverProfile.id,
            requestId: activeRequest?.id,
            deliveryRequestId: activeDelivery?.id,
            lat,
            lng
        }
    });

    // Update last known location (for easy access)
    if (activeDelivery) {
      await prisma.deliveryRequest.update({
        where: { id: activeDelivery.id },
        data: {
          lastKnownLat: lat,
          lastKnownLng: lng,
          lastKnownAt: new Date(),
        },
      });
    } else if (activeRequest) {
      await prisma.request.update({
        where: { id: activeRequest.id },
        data: {
          lastKnownLat: lat,
          lastKnownLng: lng,
          lastKnownAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Location ping error:', error);
    return new NextResponse('Invalid request', { status: 400 });
  }
}
