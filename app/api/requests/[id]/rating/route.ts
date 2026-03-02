import { NextRequest, NextResponse } from 'next/server';
import { DeliveryRequestStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';

export const runtime = 'nodejs';

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

async function recomputeDriverPerformanceMetrics(prisma: ReturnType<typeof getPrisma>, driverProfileId: string) {
  const [driverProfile, deliveredRequests] = await Promise.all([
    prisma.driverProfile.findUnique({
      where: { id: driverProfileId },
      select: { id: true, performanceMetrics: true },
    }),
    prisma.deliveryRequest.findMany({
      where: {
        assignedDriverId: driverProfileId,
        status: DeliveryRequestStatus.DELIVERED,
      },
      select: {
        estimatedMinutes: true,
        customerRating: true,
        complaintFlag: true,
        timeLogs: {
          where: { endTime: { not: null } },
          select: { activeMinutes: true },
        },
      },
    }),
  ]);

  if (!driverProfile) return;

  const existingMetrics = (driverProfile.performanceMetrics ?? {}) as Record<string, unknown>;
  const cancelRateRolling =
    typeof existingMetrics.cancelRateRolling === 'number' ? existingMetrics.cancelRateRolling : 0;
  const performanceScore =
    typeof existingMetrics.performanceScore === 'number' ? existingMetrics.performanceScore : 0;

  let completedJobs = 0;
  let onTimeCount = 0;
  let earlyCount = 0;
  let fiveStarCount = 0;
  let complaintCount = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  for (const request of deliveredRequests) {
    completedJobs += 1;
    if (request.complaintFlag) complaintCount += 1;
    if (request.customerRating === 5) fiveStarCount += 1;
    if (typeof request.customerRating === 'number' && Number.isFinite(request.customerRating)) {
      ratingSum += request.customerRating;
      ratingCount += 1;
    }

    const estimatedMinutes =
      typeof request.estimatedMinutes === 'number' && Number.isFinite(request.estimatedMinutes)
        ? Math.max(0, Math.trunc(request.estimatedMinutes))
        : 0;

    if (estimatedMinutes <= 0) continue;

    const activeMinutes = request.timeLogs.reduce((sum, log) => {
      return sum + Math.max(0, Math.trunc(log.activeMinutes));
    }, 0);

    if (activeMinutes <= estimatedMinutes + 10) onTimeCount += 1;
    if (activeMinutes <= Math.max(1, estimatedMinutes - 5)) earlyCount += 1;
  }

  const nextMetrics: Record<string, unknown> = {
    ...existingMetrics,
    completedJobs,
    onTimeCount,
    fiveStarCount,
    complaintCount,
    earlyCount,
    ratingSum,
    ratingCount,
    avgRatingRolling: ratingCount > 0 ? ratingSum / ratingCount : 0,
    onTimeRateRolling: completedJobs > 0 ? onTimeCount / completedJobs : 0,
    cancelRateRolling,
    flagsCount: complaintCount,
    performanceScore,
  };

  await prisma.driverProfile.update({
    where: { id: driverProfileId },
    data: {
      performanceMetrics: nextMetrics as Prisma.InputJsonValue,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ratingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid rating', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { id } = await params;
    const prisma = getPrisma();
    const request = await prisma.deliveryRequest.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        assignedDriverId: true,
      },
    });

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const isOwner = request.userId === user.id;
    const isAdmin = user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (request.status === DeliveryRequestStatus.DRAFT) {
      return NextResponse.json({ error: 'Request has not been placed yet' }, { status: 409 });
    }

    const updated = await prisma.deliveryRequest.update({
      where: { id: request.id },
      data: { customerRating: parsed.data.rating },
      select: {
        id: true,
        customerRating: true,
        status: true,
      },
    });

    if (request.assignedDriverId && request.status === DeliveryRequestStatus.DELIVERED) {
      await recomputeDriverPerformanceMetrics(prisma, request.assignedDriverId);
    }

    return NextResponse.json({
      id: updated.id,
      rating: updated.customerRating,
      status: updated.status,
    });
  } catch (error) {
    console.error('[requests/rating] Failed to update rating', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
