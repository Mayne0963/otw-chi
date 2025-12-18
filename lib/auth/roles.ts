import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

export async function getCurrentUser() {
  try {
    const { userId } = await auth();
    if (!userId) return null;
    const prisma = getPrisma();
    let user = await prisma.user.findFirst({ where: { clerkId: userId } });
    
    // If user is authenticated in Clerk but missing in DB, sync them now
    if (!user) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
        const name = clerkUser.firstName && clerkUser.lastName ? `${clerkUser.firstName} ${clerkUser.lastName}` : clerkUser.username || email;
        const roleMeta = String(clerkUser.publicMetadata?.role || 'CUSTOMER').toUpperCase();
        const role = roleMeta === 'DRIVER' || roleMeta === 'ADMIN' || roleMeta === 'FRANCHISE' ? roleMeta : 'CUSTOMER';
        
        user = await prisma.user.create({
          data: { clerkId: userId, email, name, role } as any,
        });
        // Create profile async (don't block)
        prisma.customerProfile.create({ data: { userId: user.id } }).catch(console.error);
      } catch (syncError) {
        console.error("Failed to sync user in getCurrentUser:", syncError);
      }
    }
    
    return user;
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    // Return null to avoid crashing the page, let the page handle "no user" state
    return null;
  }
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
