'use server';

// PrismaClient is not imported here; getPrisma() from '@/lib/db' provides the client instance
import type { Prisma } from '@prisma/client';
import { RequestStatus } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { revalidatePath } from 'next/cache';
import { calculateBasePriceCents, calculateDriverPayoutCents } from '@/lib/pricing';

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

  const jobs = await prisma.request.findMany({
    where: {
      status: 'SUBMITTED',
      zoneId: driverProfile.zoneId,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      customer: {
        select: { name: true }
      }
    }
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

  const job = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!job || job.status !== 'SUBMITTED') {
    throw new Error('Job is no longer available');
  }
  
  if (job.zoneId && job.zoneId !== driverProfile.zoneId) {
     throw new Error('Job is outside your zone');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      status: 'ASSIGNED',
      assignedDriverId: driverProfile.id,
      events: {
        create: {
          type: 'STATUS_ASSIGNED',
          message: `Accepted by driver ${user.name}`,
        },
      },
    },
  });

  revalidatePath('/driver/jobs');
  revalidatePath(`/driver/jobs/${requestId}`);
  return updated;
}

export async function acceptJobAction(formData: FormData) {
  const id = formData.get('id') as string;
  await acceptJob(id);
}

export async function updateJobStatus(requestId: string, status: RequestStatus) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) throw new Error('Unauthorized');

  const prisma = getPrisma();
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
  });

  if (!driverProfile) throw new Error('Driver profile not found');

  const job = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!job || job.assignedDriverId !== driverProfile.id) {
    throw new Error('You are not assigned to this job');
  }

  // If completing, handle earnings
  if (status === 'COMPLETED' && job.status !== 'COMPLETED') {
    return completeJob(requestId);
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      status: status,
      events: {
        create: {
          type: `STATUS_${status}`,
          message: `Status updated to ${status}`,
        },
      },
    },
  });

  revalidatePath('/driver/jobs');
  revalidatePath(`/driver/jobs/${requestId}`);
  return updated;
}

export async function updateJobStatusAction(formData: FormData) {
  const id = formData.get('id') as string;
  const status = formData.get('status') as RequestStatus;
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

  const job = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!job || job.assignedDriverId !== driverProfile.id) {
    throw new Error('You are not assigned to this job');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      status: 'COMPLETED',
      events: {
        create: {
          type: 'STATUS_COMPLETED',
          message: 'Job completed',
        },
      },
    },
  });

  const basePriceCents = job.milesEstimate
    ? calculateBasePriceCents({
        miles: job.milesEstimate,
        serviceType: job.serviceType as 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE',
      })
    : job.costEstimate || 0;
  const earningsAmount = calculateDriverPayoutCents({ basePriceCents });

  if (earningsAmount > 0) {
    // Check if earnings already exist to avoid duplicates
    const existing = await prisma.driverEarnings.findFirst({
        where: { requestId: job.id }
    });
    
    if (!existing) {
      await prisma.driverEarnings.create({
        data: {
          driverId: user.id,
          amount: earningsAmount,
          amountCents: earningsAmount,
          status: 'available',
          requestId: job.id,
        },
      });
    }
  }

  // Award NIP for customer first completed order
  if (job.customerId) {
    const count = await prisma.request.count({
      where: { customerId: job.customerId, status: 'COMPLETED' },
    });
    if (count === 1) {
      await prisma.nipTransaction.create({
        data: { userId: job.customerId, amount: 50, reason: 'FIRST_COMPLETED_ORDER', refId: job.id },
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
