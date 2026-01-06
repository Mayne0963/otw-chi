import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';

const pingSchema = z.object({
  lat: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), { message: 'lat must be a finite number' }),
  lng: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), { message: 'lng must be a finite number' }),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { driverProfile: true },
    });

    if (!user || !user.driverProfile) {
      return NextResponse.json(
        { success: false, error: 'Driver profile not found' },
        { status: 404 }
      );
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

    let pingRecorded = false;
    let pingWarning: string | null = null;

    try {
      // Save Ping
      await prisma.driverLocationPing.create({
        data: {
          driverId: user.driverProfile.id,
          requestId: activeRequest?.id,
          deliveryRequestId: activeDelivery?.id,
          lat,
          lng,
        },
      });
      pingRecorded = true;
    } catch (pingError) {
      console.error('Location ping record error:', pingError);
      pingWarning = 'Location ping history could not be recorded.';
    }

    // Update last known location (for easy access)
    try {
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
    } catch (locationUpdateError) {
      console.error('Location ping update error:', locationUpdateError);
      if (!pingWarning) {
        pingWarning = 'Unable to update live location on the active request.';
      }
    }

    return NextResponse.json({
      success: true,
      pingRecorded,
      warning: pingWarning ?? undefined,
    });
  } catch (error) {
    console.error('Location ping error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Unable to record driver location ping' },
      { status: 500 }
    );
  }
}
