import { NextResponse } from 'next/server';
import { getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { z } from 'zod';

const pingSchema = z.object({
  lat: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), { message: 'lat must be a finite number' }),
  lng: z.coerce
    .number()
    .refine((value) => Number.isFinite(value), { message: 'lng must be a finite number' }),
  requestId: z.string().optional(),
  requestType: z.enum(['delivery', 'legacy']).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getNeonSession();
    // @ts-ignore
    const userId = session?.userId || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    
    let user = await prisma.user.findUnique({
      where: { neonAuthId: userId },
      include: { driverProfile: true },
    });

    if (!user) {
      // @ts-ignore
      const email = session.user?.email;
      if (!email) {
        return NextResponse.json({ success: false, error: 'Missing user email' }, { status: 400 });
      }

      // Default to CUSTOMER if creating new
      user = await prisma.user.create({
        data: { neonAuthId: userId, email, role: 'CUSTOMER' },
        include: { driverProfile: true },
      });
    }

    // Role is now authoritative in DB, no need to sync from sessionClaims
    const isDriverish = user.role === 'DRIVER' || user.role === 'ADMIN';
    
    if (!isDriverish && !user.driverProfile) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    
    // ... rest of the logic ...

    if (!user.driverProfile && isDriverish) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          driverProfile: {
            create: {
              status: 'OFFLINE',
            },
          },
        },
        include: { driverProfile: true },
      });
    }

    if (!user.driverProfile) {
      return NextResponse.json(
        { success: false, error: 'Driver profile not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { lat, lng, requestId, requestType } = pingSchema.parse(body);

    let activeDelivery = null;
    let activeRequest = null;

    // If specific request context is provided, try to find that specific job first
    if (requestId && requestType === 'delivery') {
      activeDelivery = await prisma.deliveryRequest.findFirst({
        where: {
          id: requestId,
          assignedDriverId: user.driverProfile.id,
        },
      });
    } else if (requestId && requestType === 'legacy') {
      activeRequest = await prisma.request.findFirst({
        where: {
          id: requestId,
          assignedDriverId: user.driverProfile.id,
        },
      });
    }

    // Fallback: Find any active delivery request if not found above
    if (!activeDelivery && !activeRequest) {
      activeDelivery = await prisma.deliveryRequest.findFirst({
        where: {
          assignedDriverId: user.driverProfile.id,
          status: { in: ['ASSIGNED', 'PICKED_UP', 'EN_ROUTE'] },
        },
      });
    }

    // Fallback: Find any active legacy request if not found above
    if (!activeDelivery && !activeRequest) {
      activeRequest = await prisma.request.findFirst({
        where: {
          assignedDriverId: user.driverProfile.id,
          status: { in: ['ASSIGNED', 'PICKED_UP', 'EN_ROUTE'] },
        },
      });
    }

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

    const desiredStatus = activeDelivery || activeRequest ? 'BUSY' : 'ONLINE';
    try {
      if (user.driverProfile?.status !== desiredStatus) {
        await prisma.driverProfile.update({
          where: { id: user.driverProfile!.id },
          data: { status: desiredStatus },
        });
      }
    } catch (statusError) {
      console.error('Driver status update error:', statusError);
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
