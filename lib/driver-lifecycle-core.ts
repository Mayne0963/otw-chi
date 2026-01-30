import { DeliveryRequestStatus, DriverEarningStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { calculateDriverPayCents } from './driver-pay';

type PrismaLikeClient = {
  $transaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
};

export async function acceptDeliveryRequest(requestId: string, driverId: string, client: PrismaLikeClient) {
  return await client.$transaction(async (tx) => {
    const request = await tx.deliveryRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new Error('Request not found');
    if (request.status !== DeliveryRequestStatus.REQUESTED) {
      throw new Error('Request is not available for acceptance');
    }

    const now = new Date();
    const breakdown = request.quoteBreakdown as unknown as {
      dispatchPreferences?: {
        preferredDriverId?: string | null;
        lockToPreferred?: boolean;
        lockExpiresAtIso?: string | null;
      };
    } | null;
    const preferredDriverId = breakdown?.dispatchPreferences?.preferredDriverId ?? null;
    const lockToPreferred = Boolean(breakdown?.dispatchPreferences?.lockToPreferred);
    const lockExpiresAtIso = breakdown?.dispatchPreferences?.lockExpiresAtIso ?? null;
    if (lockToPreferred && preferredDriverId && lockExpiresAtIso) {
      const expires = new Date(lockExpiresAtIso);
      if (!Number.isNaN(expires.getTime()) && now.getTime() < expires.getTime() && driverId !== preferredDriverId) {
        throw new Error('Request is reserved for a preferred driver');
      }
    }

    const updatedRequest = await tx.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: DeliveryRequestStatus.ASSIGNED,
        assignedDriverId: driverId,
        assignedAt: now,
      },
    });

    const existingOpenLog = await tx.driverTimeLog.findFirst({
      where: { deliveryRequestId: requestId, driverId, endTime: null },
      select: { id: true },
    });
    if (!existingOpenLog) {
      await tx.driverTimeLog.create({
        data: {
          driverId,
          deliveryRequestId: requestId,
          startTime: now,
        },
      });
    }

    await tx.driverAssignment.create({
      data: {
        deliveryRequestId: requestId,
        driverId,
        assignedAt: now,
      },
    });

    return updatedRequest;
  });
}

export async function markDriverArrived(requestId: string, driverId: string, client: PrismaLikeClient) {
  return await client.$transaction(async (tx) => {
    const request = await tx.deliveryRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new Error('Request not found');
    if (request.assignedDriverId !== driverId) throw new Error('Not assigned to this driver');
    if (request.status !== DeliveryRequestStatus.ASSIGNED) throw new Error('Request is not in assigned state');
    if (request.arrivedAt) throw new Error('Driver already marked arrived');

    const now = new Date();

    const updatedRequest = await tx.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: DeliveryRequestStatus.PICKED_UP,
        arrivedAt: now,
      },
    });

    const existingOpenLog = await tx.driverTimeLog.findFirst({
      where: { deliveryRequestId: requestId, driverId, endTime: null },
      select: { id: true, startTime: true },
    });
    if (!existingOpenLog) {
      const startTime = request.assignedAt ?? now;
      await tx.driverTimeLog.create({
        data: {
          driverId,
          deliveryRequestId: requestId,
          startTime,
        },
      });
    }

    return updatedRequest;
  });
}

export async function markDriverDepartedPickup(requestId: string, driverId: string, client: PrismaLikeClient) {
  return await client.$transaction(async (tx) => {
    const request = await tx.deliveryRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new Error('Request not found');
    if (request.assignedDriverId !== driverId) throw new Error('Not assigned to this driver');
    if (request.status !== DeliveryRequestStatus.PICKED_UP) throw new Error('Request is not in picked up state');
    if (!request.arrivedAt) throw new Error('Driver arrival time not recorded');

    const now = new Date();
    // Calculate wait time: difference between arrival and departure (now)
    const waitTimeMs = now.getTime() - request.arrivedAt.getTime();
    let actualWaitMinutes = Math.ceil(waitTimeMs / (1000 * 60));
    
    // Enforce 10-minute minimum wait time (floor)
    const MIN_WAIT_MINUTES = 10;
    actualWaitMinutes = Math.max(MIN_WAIT_MINUTES, actualWaitMinutes);

    const updatedRequest = await tx.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: DeliveryRequestStatus.EN_ROUTE,
        actualWaitMinutes,
      },
    });

    return updatedRequest;
  });
}

export async function completeDeliveryRequest(requestId: string, driverId: string, client: PrismaLikeClient) {
  return await client.$transaction(async (tx) => {
    const request = await tx.deliveryRequest.findUnique({
      where: { id: requestId },
      include: {
        timeLogs: {
          where: { driverId, endTime: null },
        },
      },
    });

    const driver = await tx.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!request) throw new Error('Request not found');
    if (!driver) throw new Error('Driver not found');
    if (request.assignedDriverId !== driverId) throw new Error('Not assigned to this driver');
    if (!request.arrivedAt) throw new Error('Cannot complete before arriving');
    if (request.completedAt) throw new Error('Already completed');
    if (request.status !== DeliveryRequestStatus.PICKED_UP && request.status !== DeliveryRequestStatus.EN_ROUTE) {
      throw new Error('Request is not in a completable state');
    }

    const openLog = request.timeLogs[0];
    if (!openLog) throw new Error('No active time log found for pay calculation');

    const now = new Date();
    const durationMs = now.getTime() - openLog.startTime.getTime();
    const activeMinutes = Math.ceil(durationMs / (1000 * 60));

    await tx.driverTimeLog.update({
      where: { id: openLog.id },
      data: {
        endTime: now,
        activeMinutes,
      },
    });

    const tipsCents = typeof request.tipCents === 'number' && Number.isFinite(request.tipCents) ? request.tipCents : 0;
    const bonusEligible = request.customerRating === 5 && !request.complaintFlag && driver.bonusEnabled;

    const serviceMiles = request.serviceMilesFinal;
    if (typeof serviceMiles !== 'number' || !Number.isFinite(serviceMiles) || serviceMiles <= 0) {
      throw new Error('Missing Service Miles for request payout calculation');
    }

    const membership = await tx.membershipSubscription.findUnique({
      where: { userId: request.userId },
      include: { plan: true },
    });
    const planName = membership?.plan?.name ?? '';
    const estimatedMinutes = typeof request.estimatedMinutes === 'number' ? request.estimatedMinutes : 0;
    const onTimeEligible = estimatedMinutes > 0 ? activeMinutes <= estimatedMinutes + 10 : false;
    const earlyEligible = estimatedMinutes > 0 ? activeMinutes <= Math.max(1, estimatedMinutes - 5) : false;

    const {
      milePayCents,
      waitBonusCents,
      cashBonusCents,
      businessBonusCents,
      bonusPayCents,
      performanceBonusCents,
      speedBonusCents,
      hourlyPayCents,
      tipsCents: normalizedTipsCents,
      totalPayCents,
      rateCentsPerServiceMile,
      hourlyRateCents,
    } = calculateDriverPayCents({
      driverTier: driver.tierLevel,
      activeMinutes,
      tipsCents,
      bonusEligible,
      planName,
      hourlyRateCents: driver.hourlyRateCents > 0 ? driver.hourlyRateCents : undefined,
      bonus5StarCents: driver.bonus5StarCents > 0 ? driver.bonus5StarCents : undefined,
      onTimeEligible,
      earlyEligible,
    });

    const existingEarnings = await tx.driverEarnings.findFirst({
      where: {
        driverId: driver.userId,
        requestId: request.id,
      },
      select: { id: true },
    });
    if (existingEarnings) throw new Error('Earnings already created for this request');

    await tx.driverEarnings.create({
      data: {
        driverId: driver.userId,
        amount: totalPayCents,
        amountCents: totalPayCents,
        tipCents: tipsCents,
        status: DriverEarningStatus.pending,
        requestId: request.id,
      },
    });

    const updatedRequest = await tx.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: DeliveryRequestStatus.DELIVERED,
        completedAt: now,
      },
    });

    const rawMetrics = (driver.performanceMetrics ?? {}) as Record<string, unknown>;
    const completedJobs = typeof rawMetrics.completedJobs === 'number' ? rawMetrics.completedJobs : 0;
    const onTimeCount = typeof rawMetrics.onTimeCount === 'number' ? rawMetrics.onTimeCount : 0;
    const fiveStarCount = typeof rawMetrics.fiveStarCount === 'number' ? rawMetrics.fiveStarCount : 0;
    const complaintCount = typeof rawMetrics.complaintCount === 'number' ? rawMetrics.complaintCount : 0;
    const earlyCount = typeof rawMetrics.earlyCount === 'number' ? rawMetrics.earlyCount : 0;
    const ratingSum = typeof rawMetrics.ratingSum === 'number' ? rawMetrics.ratingSum : 0;
    const ratingCount = typeof rawMetrics.ratingCount === 'number' ? rawMetrics.ratingCount : 0;
    const cancelRateRolling = typeof rawMetrics.cancelRateRolling === 'number' ? rawMetrics.cancelRateRolling : 0;

    const ratingValue =
      typeof request.customerRating === 'number' && Number.isFinite(request.customerRating) ? request.customerRating : null;
    const nextRatingSum = ratingSum + (ratingValue ?? 0);
    const nextRatingCount = ratingCount + (ratingValue === null ? 0 : 1);
    const nextMetrics: Record<string, unknown> = {
      ...rawMetrics,
      completedJobs: completedJobs + 1,
      onTimeCount: onTimeCount + (onTimeEligible ? 1 : 0),
      fiveStarCount: fiveStarCount + (request.customerRating === 5 ? 1 : 0),
      complaintCount: complaintCount + (request.complaintFlag ? 1 : 0),
      earlyCount: earlyCount + (earlyEligible ? 1 : 0),
      ratingSum: nextRatingSum,
      ratingCount: nextRatingCount,
      avgRatingRolling: nextRatingCount > 0 ? nextRatingSum / nextRatingCount : 0,
      onTimeRateRolling: completedJobs + 1 > 0 ? (onTimeCount + (onTimeEligible ? 1 : 0)) / (completedJobs + 1) : 0,
      cancelRateRolling,
      flagsCount: complaintCount + (request.complaintFlag ? 1 : 0),
    };
    await tx.driverProfile.update({
      where: { id: driverId },
      data: {
        performanceMetrics: nextMetrics as Prisma.InputJsonValue,
      },
    });

    return {
      request: updatedRequest,
      pay: {
        activeMinutes,
        serviceMiles,
        hourlyRateCents,
        rateCentsPerServiceMile,
        milePayCents,
        hourlyPayCents,
        waitBonusCents,
        cashBonusCents,
        businessBonusCents,
        bonusPayCents,
        performanceBonusCents,
        speedBonusCents,
        tipsCents: normalizedTipsCents,
        totalPayCents,
      },
    };
  });
}
