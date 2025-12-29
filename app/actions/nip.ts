'use server';

import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription } from '@/lib/membership';

export async function getNipBalance(userId?: string) {
  const prisma = getPrisma();
  const uid = userId ?? (await getCurrentUser())?.id;
  if (!uid) return 0;
  const txns = await prisma.nipTransaction.findMany({ where: { userId: uid } }).catch(() => []) ?? [];
  return txns.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
}

export async function getNipTransactions(userId?: string) {
  const prisma = getPrisma();
  const uid = userId ?? (await getCurrentUser())?.id;
  if (!uid) return [];
  return prisma.nipTransaction.findMany({
    where: { userId: uid },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }) ?? [];
}

export async function awardFirstCompletedOrder(customerId: string, requestId: string) {
  const prisma = getPrisma();
  const count = await prisma.request.count({
    where: { customerId, status: 'COMPLETED' },
  });
  if (count === 1) {
    await prisma.nipTransaction.create({
      data: { userId: customerId, amount: 50, reason: 'FIRST_COMPLETED_ORDER', refId: requestId },
    }).catch(() => {});
  }
}

export async function ensureWeeklyActiveMemberGrant() {
  const user = await getCurrentUser();
  if (!user) return;
  const prisma = getPrisma();
  const sub = await getActiveSubscription(user.id);
  if (!sub || sub.status !== 'ACTIVE') return;
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const existing = await prisma.nipTransaction.findFirst({
    where: {
      userId: user.id,
      reason: 'WEEKLY_ACTIVE_MEMBER',
      createdAt: { gte: startOfWeek },
    },
  }) ?? null;
  if (!existing) {
    await prisma.nipTransaction.create({
      data: { userId: user.id, amount: 25, reason: 'WEEKLY_ACTIVE_MEMBER' },
    }).catch(() => {});
  }
}

export async function awardOnTimePayment(userId: string, refId?: string) {
  const prisma = getPrisma();
  await prisma.nipTransaction.create({
    data: { userId, amount: 10, reason: 'ON_TIME_PAYMENT', refId },
  }).catch(() => {});
}

export async function awardReferral(userId: string, refId?: string) {
  const prisma = getPrisma();
  await prisma.nipTransaction.create({
    data: { userId, amount: 100, reason: 'REFERRAL_BONUS', refId },
  }).catch(() => {});
}

export async function spendNip(userId: string, amount: number, reason: 'ORDER_DISCOUNT' | 'PRIORITY_DISPATCH' | 'FEE_WAIVER', refId?: string) {
  const prisma = getPrisma();
  if (amount <= 0) return;
  await prisma.nipTransaction.create({
    data: { userId, amount: -Math.abs(amount), reason, refId },
  }).catch(() => {});
}
