import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
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
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    const normalizeRole = (raw: unknown) => {
      const role = String(raw ?? '').toUpperCase();
      if (role === 'ADMIN' || role === 'DRIVER' || role === 'FRANCHISE' || role === 'CUSTOMER') {
        return role as 'ADMIN' | 'DRIVER' | 'FRANCHISE' | 'CUSTOMER';
      }
      return 'CUSTOMER';
    };

    const sessionRoleRaw = (
      sessionClaims as {
        publicMetadata?: { role?: string };
        metadata?: { role?: string };
        otw?: { role?: string };
      } | null
    )?.publicMetadata?.role ??
      (
        sessionClaims as {
          publicMetadata?: { role?: string };
          metadata?: { role?: string };
          otw?: { role?: string };
        } | null
      )?.metadata?.role ??
      (
        sessionClaims as {
          publicMetadata?: { role?: string };
          metadata?: { role?: string };
          otw?: { role?: string };
        } | null
      )?.otw?.role ??
      null;

    const sessionRole = normalizeRole(sessionRoleRaw);

    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { driverProfile: true },
    });

    if (!user) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
      if (!email) {
        return NextResponse.json({ success: false, error: 'Missing user email' }, { status: 400 });
      }

      const role =
        sessionRole !== 'CUSTOMER'
          ? sessionRole
          : normalizeRole(clerkUser?.publicMetadata?.role);
      user = await prisma.user.create({
        data: { clerkId: userId, email, role },
        include: { driverProfile: true },
      });
    }

    const resolvedRole =
      user.role === 'CUSTOMER' && sessionRole !== 'CUSTOMER'
        ? sessionRole
        : (user.role as 'ADMIN' | 'DRIVER' | 'FRANCHISE' | 'CUSTOMER');

    if (resolvedRole !== user.role) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: resolvedRole },
        include: { driverProfile: true },
      });
    }

    const isDriverish = resolvedRole === 'DRIVER' || resolvedRole === 'ADMIN';
    if (!isDriverish && !user.driverProfile) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

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
