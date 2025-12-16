import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user;
}

export async function getUserRole(): Promise<'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE'> {
  const { userId } = await auth();
  if (!userId) return 'CUSTOMER';
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const metaRole = (user.publicMetadata?.role as string | undefined)?.toUpperCase();
  if (metaRole === 'DRIVER' || metaRole === 'ADMIN' || metaRole === 'FRANCHISE' || metaRole === 'CUSTOMER') {
    return metaRole as any;
  }
  const prisma = getPrisma();
  const row = await prisma.user.findFirst({ where: { clerkId: userId } });
  if (row && (row.role === 'DRIVER' || row.role === 'ADMIN' || row.role === 'FRANCHISE' || row.role === 'CUSTOMER')) {
    return row.role as any;
  }
  return 'CUSTOMER';
}

export async function requireRole(roles: Array<'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE'>) {
  const role = await getUserRole();
  if (!roles.includes(role)) {
    throw new Error('Forbidden');
  }
  return role;
}
