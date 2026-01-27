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

    const updatedRequest = await tx.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: DeliveryRequestStatus.ASSIGNED,
        assignedDriverId: driverId,
        assignedAt: now,
      },
    });

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

    const existingOpenLog = await tx.driverTimeLog.findFirst({
      where: { deliveryRequestId: requestId, driverId, endTime: null },
      select: { id: true },
    });
    if (existingOpenLog) throw new Error('Active time log already exists');

    const now = new Date();

    const updatedRequest = await tx.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: DeliveryRequestStatus.PICKED_UP,
        arrivedAt: now,
      },
    });

    await tx.driverTimeLog.create({
      data: {
        driverId,
        deliveryRequestId: requestId,
        startTime: now,
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

    const tipsCents = 0;
    const bonusEligible = request.customerRating === 5 && !request.complaintFlag && driver.bonusEnabled;

    const serviceMiles = request.serviceMilesFinal;
    if (typeof serviceMiles !== 'number' || !Number.isFinite(serviceMiles) || serviceMiles <= 0) {
      throw new Error('Missing Service Miles for request payout calculation');
    }

    const breakdown = (request.quoteBreakdown ?? {}) as Record<string, unknown>;
    const breakdownAdders = (breakdown as { adders?: unknown })?.adders as Record<string, unknown> | undefined;
    const waitTimeMiles = typeof breakdownAdders?.waitTime === 'number' ? breakdownAdders.waitTime : 0;
    const sitAndWaitPremiumMiles =
      typeof breakdownAdders?.sitAndWaitPremium === 'number' ? breakdownAdders.sitAndWaitPremium : 0;
    const cashHandlingMiles = typeof breakdownAdders?.cashHandling === 'number' ? breakdownAdders.cashHandling : 0;

    const membership = await tx.membershipSubscription.findUnique({
      where: { userId: request.userId },
      include: { plan: true },
    });
    const planName = membership?.plan?.name ?? '';
    const businessAccount = planName.startsWith('OTW BUSINESS') || planName === 'OTW ENTERPRISE';

    const {
      milePayCents,
      waitBonusCents,
      cashBonusCents,
      businessBonusCents,
      bonusPayCents,
      tipsCents: normalizedTipsCents,
      totalPayCents,
      rateCentsPerServiceMile,
    } = calculateDriverPayCents({
      serviceMiles,
      driverTier: driver.tierLevel,
      tipsCents,
      bonusEligible,
      bonus5StarCents: driver.bonus5StarCents,
      waitMiles: waitTimeMiles + sitAndWaitPremiumMiles,
      cashHandling: cashHandlingMiles > 0,
      businessAccount,
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
    const nextMetrics: Record<string, unknown> = {
      ...rawMetrics,
      completedJobs: completedJobs + 1,
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
        rateCentsPerServiceMile,
        milePayCents,
        waitBonusCents,
        cashBonusCents,
        businessBonusCents,
        bonusPayCents,
        tipsCents: normalizedTipsCents,
        totalPayCents,
      },
    };
  });
}
