'use server';

// PrismaClient is not imported here; getPrisma() from '@/lib/db' provides the client instance
import type { Prisma } from '@prisma/client';
import { DeliveryRequestStatus } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { revalidatePath } from 'next/cache';
import { DRIVER_ACTIVE_REQUEST_STATUSES } from '@/lib/driver-assignment';
import {
  completeDeliveryRequest as completeDeliveryRequestLifecycle,
  markDriverArrived as markDriverArrivedLifecycle,
  markDriverDepartedPickup as markDriverDepartedPickupLifecycle,
} from '@/lib/driver-lifecycle';
import {
  DISPATCH_PAYMENT_REQUIRED_ERROR,
  isDispatchBlockedByPayment,
} from '@/lib/request-payment';
import {
  createSystemRequestMessage,
  DRIVER_ASSIGNED_CHAT_OPEN_MESSAGE,
} from '@/lib/request-chat';

export const DRIVER_OWN_REQUEST_ERROR = 'Drivers cannot accept their own requests';

export type AcceptJobResult =
  | {
      ok: true;
      requestId: string;
    }
  | {
      ok: false;
      code:
        | 'UNAUTHORIZED'
        | 'DRIVER_NOT_FOUND'
        | 'UNAVAILABLE'
        | 'PAYMENT_REQUIRED'
        | 'NOT_DISPATCHABLE'
        | 'OVERAGE_UNPAID'
        | 'OWN_REQUEST'
        | 'DRIVER_BUSY'
        | 'ALREADY_ASSIGNED'
        | 'FAILED';
      error: string;
    };

export async function getAvailableJobs() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) return [];

  const prisma = getPrisma();
  
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
  });

  if (!driverProfile?.zoneId) {
    return [];
  }

  const activeJob = await prisma.deliveryRequest.findFirst({
    where: {
      assignedDriverId: driverProfile.id,
      status: { in: DRIVER_ACTIVE_REQUEST_STATUSES },
      OR: [
        { dispatchAt: null },
        { dispatchAt: { lte: new Date() } },
      ],
    },
    select: { id: true },
  });
  if (activeJob) {
    return [];
  }

  const jobs = await prisma.deliveryRequest.findMany({
    where: {
      status: 'REQUESTED',
      assignedDriverId: null,
      userId: { not: user.id },
      OR: [
        { deliveryFeePaid: true },
        { paymentRequired: false },
      ],
      AND: [
        {
          OR: [
            { dispatchAt: null },
            { dispatchAt: { lte: new Date() } },
          ],
        },
      ],
      NOT: {
        AND: [
          { overageBillingMode: 'INSTANT' },
          { overageMiles: { gt: 0 } },
          { overageStatus: { not: 'PAID' } },
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      status: true,
      pickupAddress: true,
      dropoffAddress: true,
      serviceType: true,
      createdAt: true,
      paymentRequired: true,
      deliveryFeePaid: true,
      deliveryFeeCents: true,
      overageBillingMode: true,
      overageMiles: true,
      overageStatus: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  return jobs;
}

export async function acceptJob(requestId: string): Promise<AcceptJobResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      error: 'Unauthorized',
    };
  }

  const prisma = getPrisma();
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
  });

  if (!driverProfile) {
    return {
      ok: false,
      code: 'DRIVER_NOT_FOUND',
      error: 'Driver profile not found',
    };
  }

  const job = await prisma.deliveryRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      paymentRequired: true,
      deliveryFeePaid: true,
      deliveryFeeCents: true,
      overageBillingMode: true,
      overageMiles: true,
      overageStatus: true,
      userId: true,
      assignedDriverId: true,
      dispatchAt: true,
    },
  });

  if (!job || job.status !== 'REQUESTED') {
    return {
      ok: false,
      code: 'UNAVAILABLE',
      error: 'Job is no longer available',
    };
  }
  if (isDispatchBlockedByPayment(job)) {
    return {
      ok: false,
      code: 'PAYMENT_REQUIRED',
      error: DISPATCH_PAYMENT_REQUIRED_ERROR,
    };
  }
  if (job.dispatchAt && job.dispatchAt.getTime() > Date.now()) {
    return {
      ok: false,
      code: 'NOT_DISPATCHABLE',
      error: 'Request is scheduled and not dispatchable yet',
    };
  }
  if (job.overageBillingMode === 'INSTANT' && job.overageMiles > 0 && job.overageStatus !== 'PAID') {
    return {
      ok: false,
      code: 'OVERAGE_UNPAID',
      error: 'Job overage payment is not settled',
    };
  }
  if (job.userId === user.id) {
    return {
      ok: false,
      code: 'OWN_REQUEST',
      error: DRIVER_OWN_REQUEST_ERROR,
    };
  }
  const activeJob = await prisma.deliveryRequest.findFirst({
    where: {
      assignedDriverId: driverProfile.id,
      status: { in: DRIVER_ACTIVE_REQUEST_STATUSES },
      id: { not: requestId },
    },
    select: { id: true },
  });
  if (activeJob) {
    return {
      ok: false,
      code: 'DRIVER_BUSY',
      error: 'Driver already has an active request',
    };
  }
  
  if (job.assignedDriverId) {
    return {
      ok: false,
      code: 'ALREADY_ASSIGNED',
      error: 'Job is already assigned',
    };
  }

  let updatedRequestId = requestId;
  try {
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const assigned = await tx.deliveryRequest.update({
        where: { id: requestId },
        data: {
          status: 'ASSIGNED',
          assignedDriverId: driverProfile.id,
          chatEnabled: true,
          chatClosedAt: null,
        },
      });

      await createSystemRequestMessage(tx, {
        deliveryRequestId: assigned.id,
        senderUserId: user.id,
        senderRole: user.role,
        messageText: DRIVER_ASSIGNED_CHAT_OPEN_MESSAGE,
      });

      return assigned;
    });

    updatedRequestId = updated.id;
  } catch (error) {
    console.error('[acceptJob] Failed to assign job:', error);
    return {
      ok: false,
      code: 'FAILED',
      error: 'Unable to accept this request right now.',
    };
  }

  revalidatePath('/driver/jobs');
  revalidatePath(`/driver/jobs/${requestId}`);
  return { ok: true, requestId: updatedRequestId };
}

export async function acceptJobAction(formData: FormData) {
  const id = formData.get('id') as string;
  const result = await acceptJob(id);
  if (!result.ok) {
    throw new Error(result.error);
  }
}

export async function updateJobStatus(requestId: string, status: DeliveryRequestStatus) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) throw new Error('Unauthorized');

  const prisma = getPrisma();
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
  });

  if (!driverProfile) throw new Error('Driver profile not found');

  const job = await prisma.deliveryRequest.findUnique({
    where: { id: requestId },
  });

  if (!job || job.assignedDriverId !== driverProfile.id) {
    throw new Error('You are not assigned to this job');
  }

  if (status === 'PICKED_UP') {
    const updated = await markDriverArrivedLifecycle(requestId, driverProfile.id);
    revalidatePath('/driver/jobs');
    revalidatePath(`/driver/jobs/${requestId}`);
    revalidatePath('/driver/earnings');
    return updated;
  }

  if (status === 'EN_ROUTE') {
    const updated = await markDriverDepartedPickupLifecycle(requestId, driverProfile.id);
    revalidatePath('/driver/jobs');
    revalidatePath(`/driver/jobs/${requestId}`);
    revalidatePath('/driver/earnings');
    return updated;
  }

  if (status === 'DELIVERED' && job.status !== 'DELIVERED') {
    const updated = await completeDeliveryRequestLifecycle(requestId, driverProfile.id);
    revalidatePath('/driver/jobs');
    revalidatePath(`/driver/jobs/${requestId}`);
    revalidatePath('/driver/earnings');
    return updated;
  }

  const updated = await prisma.deliveryRequest.update({
    where: { id: requestId },
    data: {
      status: status,
    },
  });

  revalidatePath('/driver/jobs');
  revalidatePath(`/driver/jobs/${requestId}`);
  return updated;
}

export async function updateJobStatusAction(formData: FormData) {
  const id = formData.get('id') as string;
  const status = formData.get('status') as DeliveryRequestStatus;
  await updateJobStatus(id, status);
}

export async function completeJob(requestId: string) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) throw new Error('Unauthorized');

  const prisma = getPrisma();
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
  });

  if (!driverProfile) throw new Error('Driver profile not found');

  const job = await prisma.deliveryRequest.findUnique({
    where: { id: requestId },
  });

  if (!job || job.assignedDriverId !== driverProfile.id) {
    throw new Error('You are not assigned to this job');
  }

  const updated = await completeDeliveryRequestLifecycle(requestId, driverProfile.id);

  revalidatePath('/driver/jobs');
  revalidatePath(`/driver/jobs/${requestId}`);
  revalidatePath('/driver/earnings');
  
  return updated;
}

export async function getDriverEarnings() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) {
    return { total: 0, history: [], availableCents: 0, paidOutCents: 0, processingPayoutCents: 0 };
  }

  const prisma = getPrisma();

  const [earnings, paidAgg, processingAgg] = await Promise.all([
    prisma.driverEarnings.findMany({
      where: { driverId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.driverPayout.aggregate({
      where: { driverId: user.id, status: 'paid' },
      _sum: { totalCents: true },
    }),
    prisma.driverPayout.aggregate({
      where: { driverId: user.id, status: 'processing' },
      _sum: { totalCents: true },
    }),
  ]);

  const total = earnings.reduce((sum: number, e: { amountCents?: number | null; amount?: number | null }) => {
    const cents = e.amountCents ?? e.amount ?? 0;
    return sum + cents;
  }, 0);
  const paidOutCents = paidAgg._sum.totalCents ?? 0;
  const processingPayoutCents = processingAgg._sum.totalCents ?? 0;
  const committedPayoutCents = paidOutCents + processingPayoutCents;
  const availableCents = Math.max(0, total - committedPayoutCents);

  return { total, history: earnings, availableCents, paidOutCents, processingPayoutCents };
}

export async function requestPayoutAction(_formData: FormData) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) return;

  const prisma = getPrisma();
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existingProcessing = await tx.driverPayout.findFirst({
      where: { driverId: user.id, status: 'processing' },
      select: { id: true },
    });
    if (existingProcessing) {
      return;
    }

    const [earningsAgg, paidAgg, processingAgg] = await Promise.all([
      tx.driverEarnings.aggregate({
        where: { driverId: user.id },
        _sum: { amountCents: true, amount: true },
      }),
      tx.driverPayout.aggregate({
        where: { driverId: user.id, status: 'paid' },
        _sum: { totalCents: true },
      }),
      tx.driverPayout.aggregate({
        where: { driverId: user.id, status: 'processing' },
        _sum: { totalCents: true },
      }),
    ]);

    const earnedCents = (earningsAgg._sum.amountCents ?? earningsAgg._sum.amount ?? 0);
    const committedCents = (paidAgg._sum.totalCents ?? 0) + (processingAgg._sum.totalCents ?? 0);
    const availableCents = Math.max(0, earnedCents - committedCents);
    if (availableCents <= 0) {
      return;
    }

    await tx.driverPayout.create({
      data: {
        driverId: user.id,
        totalCents: availableCents,
        status: 'processing',
        payoutMethod: 'manual',
      },
    });

    await tx.driverEarnings.updateMany({
      where: { driverId: user.id },
      data: { status: 'pending' },
    });
  });

  revalidatePath('/driver/earnings');
  revalidatePath('/admin/payouts');
}
