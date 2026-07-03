import { extractNeonAuthUserId, getNeonSession } from '@/lib/auth/server';
import { getCurrentUser } from '@/lib/auth/roles';

export async function requireAuth() {
  const session = await getNeonSession();
  const neonAuthUserId = extractNeonAuthUserId(session);
  if (!neonAuthUserId) throw new Error('Unauthorized');
  return { id: neonAuthUserId };
}

export async function getUserRole(): Promise<'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE'> {
  const user = await getCurrentUser();
  if (!user) return 'CUSTOMER';
  return user.role;
}

export async function requireRole(roles: Array<'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE'>) {
  const session = await getNeonSession();
  const neonAuthUserId = extractNeonAuthUserId(session);
  if (!neonAuthUserId) {
    throw new Error('Unauthorized');
  }

  const role = await getUserRole();
  if (!roles.includes(role)) {
    throw new Error('Forbidden');
  }
  return role;
}
 
export async function getOtwToken(): Promise<string | null> {
  const session = await getNeonSession();
  if (!session || typeof session !== 'object') return null;
  const data = session as Record<string, unknown>;
  const sessionToken = typeof data.sessionToken === 'string' ? data.sessionToken : null;
  const token = typeof data.token === 'string' ? data.token : null;
  return sessionToken ?? token;
}
