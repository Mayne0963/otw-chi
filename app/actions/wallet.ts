'use server';

import { getCurrentUser, requireRole } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function getWalletBalance(targetUserId?: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return 0;

  // If targetUserId is provided, ensure current user is ADMIN
  if (targetUserId && targetUserId !== currentUser.id) {
    await requireRole(['ADMIN']);
  }

  const userIdToCheck = targetUserId || currentUser.id;
  const prisma = getPrisma();
  
  const result = await prisma.nIPLedger.aggregate({
    where: { userId: userIdToCheck },
    _sum: { amount: true }
  });

  return result._sum.amount || 0;
}

export async function getWalletHistory(targetUserId?: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  if (targetUserId && targetUserId !== currentUser.id) {
    await requireRole(['ADMIN']);
  }

  const userIdToCheck = targetUserId || currentUser.id;
  const prisma = getPrisma();

  return prisma.nIPLedger.findMany({
    where: { userId: userIdToCheck },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createAdjustment(targetUserId: string, amount: number, reason: string) {
  await requireRole(['ADMIN']);
  const prisma = getPrisma();

  await prisma.nIPLedger.create({
    data: {
      userId: targetUserId,
      amount: amount,
      type: 'ADJUST',
      // Storing reason in requestId field since it is a free-form string in the current schema
      requestId: reason
    }
  });
  
  revalidatePath('/admin/nip-ledger');
  revalidatePath('/wallet/nip');
}

export async function getAdminLedger(query?: string) {
  await requireRole(['ADMIN']);
  const prisma = getPrisma();

  const whereClause: any = {};
  if (query) {
    whereClause.user = {
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
        { clerkId: { contains: query } }
      ]
    };
  }

  return prisma.nIPLedger.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          email: true,
          name: true,
          clerkId: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}

export async function lookupUser(identifier: string) {
  await requireRole(['ADMIN']);
  const prisma = getPrisma();
  
  return prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: 'insensitive' } },
        { clerkId: { equals: identifier } },
        { id: { equals: identifier } }
      ]
    },
    select: { id: true, email: true, name: true }
  });
}

