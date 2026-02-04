import { getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';

export async function syncUserOnDashboard() {
  const sessionData = await getNeonSession();
  if (!sessionData) return null;

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
  
  try {
    const name = session?.user?.name || email?.split('@')[0] || 'User';
    
    const prisma = getPrisma();
    
    // Check by ID
    let user = await prisma.user.findUnique({ where: { neonAuthId: userId } });

    if (!user) {
        // Check by Email
        if (email) {
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                // Link existing user
                user = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: { neonAuthId: userId, name }
                });
            } else {
                // Create new user
                user = await prisma.user.create({
                    data: { 
                        neonAuthId: userId, 
                        email, 
                        name, 
                        role: 'CUSTOMER',
                    },
                });
            }
        }
    }

    if (!user) return null;

    // Ensure profiles
    await prisma.customerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    
    if (user.role === 'DRIVER' || user.role === 'ADMIN') {
      await prisma.driverProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, status: 'OFFLINE' },
      });
    }
    
    return user;
  } catch (error) {
    console.error("User sync failed:", error);
    return null;
  }
}
