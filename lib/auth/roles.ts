import { getPrisma } from '@/lib/db';
import { Role } from '@prisma/client';
import { getNeonSession } from '@/lib/auth/server';

export async function getCurrentUser() {
  try {
    const sessionData = await getNeonSession();
    // console.log('[getCurrentUser] sessionData:', JSON.stringify(sessionData, null, 2));
    if (!sessionData) return null;

    // Neon Auth session structure typically contains userId directly or nested in user object
    interface NeonSession {
      userId?: string;
      user?: {
        id?: string;
        email?: string;
        name?: string;
      };
    }
    const session = sessionData as unknown as NeonSession;
    const userId = session?.userId || session?.user?.id;
    const email = session?.user?.email;
    
    if (!userId) return null;
    
    const prisma = getPrisma();
    // We are using the 'neonAuthId' column to store the Neon Auth ID
    let user = await prisma.user.findUnique({ where: { neonAuthId: userId } });
    
    if (!user) {
      try {
        // Sync user from Neon Auth Session
        const neonUser = session?.user || {};
        const name = neonUser.name || email?.split('@')[0] || 'User';
        const role: Role = 'CUSTOMER'; // Default role

        if (email) {
            // Check if user exists by email to handle migration or re-login
            const existingUser = await prisma.user.findUnique({ where: { email } });

            if (existingUser) {
              // Update the existing user with the new Neon Auth ID
              user = await prisma.user.update({
                where: { id: existingUser.id },
                data: { neonAuthId: userId },
              });
            } else {
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
