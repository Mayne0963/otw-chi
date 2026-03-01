'use server';

// PrismaClient is not imported here; getPrisma() from '@/lib/db' provides the client instance
import type { Prisma } from '@prisma/client';
import { DeliveryRequestStatus } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { revalidatePath } from 'next/cache';
import { calculateDriverPayoutCents } from '@/lib/pricing';
import { DRIVER_ACTIVE_REQUEST_STATUSES } from '@/lib/driver-assignment';
import {
  DISPATCH_PAYMENT_REQUIRED_ERROR,
  isDispatchBlockedByPayment,
} from '@/lib/request-payment';
import {
  closeRequestChat,
  createSystemRequestMessage,
  DRIVER_ASSIGNED_CHAT_OPEN_MESSAGE,
} from '@/lib/request-chat';

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

export async function acceptJob(requestId: string) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) throw new Error('Unauthorized');

  const prisma = getPrisma();
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
  });

  if (!driverProfile) throw new Error('Driver profile not found');

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
    },
  });

  if (!job || job.status !== 'REQUESTED') {
    throw new Error('Job is no longer available');
  }
  if (isDispatchBlockedByPayment(job)) {
    throw new Error(DISPATCH_PAYMENT_REQUIRED_ERROR);
  }
  if (job.overageBillingMode === 'INSTANT' && job.overageMiles > 0 && job.overageStatus !== 'PAID') {
    throw new Error('Job overage payment is not settled');
  }
  if (job.userId === user.id) {
    throw new Error('Drivers cannot accept their own requests');
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
    throw new Error('Driver already has an active request');
  }
  
  if (job.assignedDriverId) {
     throw new Error('Job is already assigned');
  }

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

  revalidatePath('/driver/jobs');
  revalidatePath(`/driver/jobs/${requestId}`);
  return updated;
}

export async function acceptJobAction(formData: FormData) {
  const id = formData.get('id') as string;
  await acceptJob(id);
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

  if (status === 'DELIVERED' && job.status !== 'DELIVERED') {
    return completeJob(requestId);
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

  const updated = await prisma.deliveryRequest.update({
    where: { id: requestId },
    data: {
      status: 'DELIVERED',
    },
  });

  await closeRequestChat(prisma, {
    deliveryRequestId: requestId,
    senderUserId: user.id,
    senderRole: user.role,
  });

  const basePriceCents = job.deliveryFeeCents || 0;
  const earningsAmount = calculateDriverPayoutCents({ basePriceCents });

  if (earningsAmount > 0) {
    // Check if earnings already exist to avoid duplicates
    const existing = await prisma.driverEarnings.findFirst({
        where: { driverId: job.assignedDriverId }
    });
    
    if (!existing) {
      await prisma.driverEarnings.create({
        data: {
          driverId: user.id,
          amount: earningsAmount,
          amountCents: earningsAmount,
          status: 'available',
        },
      });
    }
  }

  // Award NIP for customer first completed order
  if (job.userId) {
    const count = await prisma.deliveryRequest.count({
      where: { userId: job.userId, status: 'DELIVERED' },
    });
    if (count === 1) {
      await prisma.nipTransaction.create({
        data: { userId: job.userId, amount: 50, reason: 'FIRST_COMPLETED_ORDER', refId: job.id },
      }).catch(() => {});
    }
  }

  revalidatePath('/driver/jobs');
  revalidatePath(`/driver/jobs/${requestId}`);
  revalidatePath('/driver/earnings');
  
  return updated;
}

export async function getDriverEarnings() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) return { total: 0, history: [] };

  const prisma = getPrisma();
  
  const earnings = await prisma.driverEarnings.findMany({
    where: { driverId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  const total = earnings.reduce((sum: number, e: { amountCents?: number | null; amount?: number | null }) => {
    const cents = (e.amountCents ?? e.amount ?? 0);
    return sum + cents;
  }, 0);

  return { total, history: earnings };
}

export async function requestPayoutAction(_formData: FormData) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) return;

  const prisma = getPrisma();
  const available = await prisma.driverEarnings.findMany({
    where: { driverId: user.id, status: 'available' },
    orderBy: { createdAt: 'asc' },
  });
  const totalCents = available.reduce((sum: number, e: { amountCents?: number | null; amount?: number | null }) => sum + (e.amountCents ?? e.amount ?? 0), 0);
  if (totalCents <= 0) {
    return;
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.driverPayout.create({
      data: {
        driverId: user.id,
        totalCents,
        status: 'processing',
        payoutMethod: 'manual',
      },
    }).catch(() => {});
    await tx.driverEarnings.updateMany({
      where: { driverId: user.id, status: 'available' },
      data: { status: 'pending' },
    }).catch(() => {});
  }).catch(() => {});

  revalidatePath('/driver/earnings');
}
