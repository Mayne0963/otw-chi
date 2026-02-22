import { getPrisma } from '@/lib/db';
import { extractNeonAuthUserId, getNeonSession } from '@/lib/auth/server';

export async function requireAuth() {
  const session = await getNeonSession();
  const neonAuthUserId = extractNeonAuthUserId(session);
  if (!neonAuthUserId) throw new Error('Unauthorized');
  return { id: neonAuthUserId };
}

export async function getUserRole(): Promise<'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE'> {
  const session = await getNeonSession();
  const neonAuthUserId = extractNeonAuthUserId(session);
  if (!neonAuthUserId) return 'CUSTOMER';

  const prisma = getPrisma();
  try {
    const row = await prisma.user.findUnique({ where: { neonAuthId: neonAuthUserId } });
    if (row && (row.role === 'DRIVER' || row.role === 'ADMIN' || row.role === 'FRANCHISE' || row.role === 'CUSTOMER')) {
      return row.role;
    }
  } catch (dbError) {
    console.error("Failed to fetch user role from DB:", dbError);
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
 
export async function getOtwToken(): Promise<string | null> {
  const session = await getNeonSession();
  // @ts-ignore
  return session?.sessionToken || session?.token || null;
}
