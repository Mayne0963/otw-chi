import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  
  // Use try-catch for external API calls that might fail
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user;
  } catch (error) {
    console.error("Failed to fetch user from Clerk:", error);
    // Return a minimal user object if the API call fails but we have a userId
    // This prevents the whole page from crashing
    return { id: userId }; 
  }
}

export async function getUserRole(): Promise<'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE'> {
  const { userId } = await auth();
  if (!userId) return 'CUSTOMER';
  
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metaRole = (user.publicMetadata?.role as string | undefined)?.toUpperCase();
    if (metaRole === 'DRIVER' || metaRole === 'ADMIN' || metaRole === 'FRANCHISE' || metaRole === 'CUSTOMER') {
      return metaRole as any;
    }
  } catch (error) {
    console.warn("Failed to fetch user role from Clerk metadata, falling back to DB:", error);
  }

  const prisma = getPrisma();
  try {
    const row = await prisma.user.findFirst({ where: { clerkId: userId } });
    if (row && (row.role === 'DRIVER' || row.role === 'ADMIN' || row.role === 'FRANCHISE' || row.role === 'CUSTOMER')) {
      return row.role as any;
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
