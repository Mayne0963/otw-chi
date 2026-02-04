import { getPrisma } from '@/lib/db';
import { Role } from '@prisma/client';
import { getNeonSession } from '@/lib/auth/server';

export async function getCurrentUser() {
  try {
    const sessionData = await getNeonSession();
    // Neon Auth session structure typically contains userId directly or nested in user object
    // We cast to any to handle potential type mismatches in the beta SDK
    const session = sessionData as any;
    const userId = session?.userId || session?.user?.id;
    
    if (!userId) return null;
    
    const prisma = getPrisma();
    // We are using the 'neonAuthId' column to store the Neon Auth ID
    let user = await prisma.user.findFirst({ where: { neonAuthId: userId } });
    
    if (!user) {
      try {
        // Sync user from Neon Auth Session
        const neonUser = session?.user || {};
        const email = neonUser.email || '';
        const name = neonUser.name || email.split('@')[0] || 'User';
        const role: Role = 'CUSTOMER'; // Default role

        if (email) {
            // Try to create user
            user = await prisma.user.create({
            data: { 
                neonAuthId: userId, 
                email, 
                name, 
                role 
            },
            });
            
            // Create profile async
            prisma.customerProfile.create({ data: { userId: user.id } }).catch(console.error);
        }
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
