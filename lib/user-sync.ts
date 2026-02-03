import { getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { Role } from '@prisma/client';

export async function syncUserOnDashboard() {
  const session = await getNeonSession();
  // @ts-ignore
  const userId = session?.userId || session?.user?.id;
  
  if (!userId) return null;
  
  try {
    // @ts-ignore
    const neonUser = session?.user || {};
    const email = neonUser.email || '';
    const name = neonUser.name || email;
    
    const prisma = getPrisma();
    
    // First check if user exists to preserve role
    const existingUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    const role = existingUser?.role || 'CUSTOMER';

    const user = await prisma.user.upsert({
      where: { clerkId: userId },
      update: { email, name }, 
      create: { 
        clerkId: userId, 
        email, 
        name, 
        role: 'CUSTOMER',
      },
    });

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
