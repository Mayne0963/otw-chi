import { getPrisma } from '@/lib/db';
import { Role } from '@prisma/client';
import { getNeonSession } from '@/lib/neon-server';

export async function getCurrentUser() {
  try {
    const sessionData = await getNeonSession();
    // @ts-ignore
    const userId = sessionData?.userId || sessionData?.user?.id;
    
    if (!userId) return null;
    
    const prisma = getPrisma();
    let user = await prisma.user.findFirst({ where: { clerkId: userId } });
    
    if (!user) {
      try {
        // Sync user from Neon Auth Session
        // @ts-ignore
        const neonUser = sessionData?.user || {};
        const email = neonUser.email || '';
        const name = neonUser.name || email;
        const role: Role = 'CUSTOMER'; // Default role

        // Try to create user
        user = await prisma.user.create({
          data: { 
            clerkId: userId, 
            email, 
            name, 
            role 
          },
        });
        
        // Create profile async
        prisma.customerProfile.create({ data: { userId: user.id } }).catch(console.error);
      } catch (syncError) {
        console.error("Failed to sync user in getCurrentUser:", syncError);
      }
    }
    
    return user;
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return null;
  }
}

export async function requireRole(allowed: Array<'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE'>) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  if (!allowed.includes(user.role)) {
    throw new Error('Forbidden');
  }
  return user;
}
