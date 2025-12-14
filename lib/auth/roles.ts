import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({ where: { clerkId: userId } });
  return user;
}

export async function requireRole(allowed: Array<'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE'>) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  if (!allowed.includes(user.role as any)) {
    throw new Error('Forbidden');
  }
  return user;
}
