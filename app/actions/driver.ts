'use server';

import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { revalidatePath } from 'next/cache';
import { RequestStatus } from '@/lib/generated/prisma';

export async function getAvailableJobs() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'DRIVER') return [];

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
  if (!user || user.role !== 'DRIVER') throw new Error('Unauthorized');

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
  if (!user || user.role !== 'DRIVER') throw new Error('Unauthorized');

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
  if (!user || user.role !== 'DRIVER') throw new Error('Unauthorized');

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

  const earningsAmount = Math.floor((job.costEstimate || 0) * 0.8);

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
            requestId: job.id,
        },
        });
    }
  }

  revalidatePath('/driver/jobs');
  revalidatePath(`/driver/jobs/${requestId}`);
  revalidatePath('/driver/earnings');
  
  return updated;
}

export async function getDriverEarnings() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'DRIVER') return { total: 0, history: [] };

  const prisma = getPrisma();
  
  const earnings = await prisma.driverEarnings.findMany({
    where: { driverId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  const total = earnings.reduce((sum, e) => sum + e.amount, 0);

  return { total, history: earnings };
}

export async function requestPayoutAction(formData: FormData) {
    // Placeholder for payout request
    const user = await getCurrentUser();
    if (!user) return;
    
    const prisma = getPrisma();
    await prisma.supportTicket.create({
        data: {
            userId: user.id,
            subject: 'Payout Request',
            message: 'Driver requested payout via dashboard.',
            status: 'OPEN'
        }
    });
    
    revalidatePath('/driver/earnings');
}
