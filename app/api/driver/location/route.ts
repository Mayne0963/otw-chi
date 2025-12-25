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

    // Find active request
    const activeRequest = await prisma.request.findFirst({
        where: {
            assignedDriverId: user.driverProfile.id,
            status: { in: ['ASSIGNED', 'PICKED_UP', 'EN_ROUTE'] }
        }
    });

    // Save Ping
    await prisma.driverLocationPing.create({
        data: {
            driverId: user.driverProfile.id,
            requestId: activeRequest?.id,
            lat,
            lng
        }
    });

    // Update Request Last Known Location (for easy access)
    if (activeRequest) {
        await prisma.request.update({
            where: { id: activeRequest.id },
            data: {
                lastKnownLat: lat,
                lastKnownLng: lng,
                lastKnownAt: new Date()
            }
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Location ping error:', error);
    return new NextResponse('Invalid request', { status: 400 });
  }
}
