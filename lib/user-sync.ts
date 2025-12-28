import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { Role } from '@prisma/client';

export async function syncUserOnDashboard() {
  const { userId } = await auth();
  if (!userId) return null;
  
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
    const name = clerkUser.firstName && clerkUser.lastName ? `${clerkUser.firstName} ${clerkUser.lastName}` : clerkUser.username || email;
    const roleMeta = String(clerkUser.publicMetadata?.role || 'CUSTOMER').toUpperCase();
    const role = (roleMeta === 'DRIVER' || roleMeta === 'ADMIN' || roleMeta === 'FRANCHISE' ? roleMeta : 'CUSTOMER') as Role;
    
    // Compliance fields from metadata (if available)
    const dobMeta = clerkUser.publicMetadata?.dob as string | undefined;
    const dob = dobMeta ? new Date(dobMeta) : null;
    const termsAcceptedAtMeta = clerkUser.publicMetadata?.termsAcceptedAt as string | undefined;
    const termsAcceptedAt = termsAcceptedAtMeta ? new Date(termsAcceptedAtMeta) : null;

    const prisma = getPrisma();
    const user = await prisma.user.upsert({
      where: { clerkId: userId },
      update: { email, name, role, dob, termsAcceptedAt },
      create: { clerkId: userId, email, name, role, dob, termsAcceptedAt },
    });
    await prisma.customerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    
    // Create driver profile for DRIVER and ADMIN roles
    if (role === 'DRIVER' || role === 'ADMIN') {
      await prisma.driverProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, status: 'OFFLINE' },
      });
    }
    
    return user;
  } catch (error) {
    console.error("User sync failed:", error);
    // Return null or throw depending on how critical this sync is.
    // Returning null allows the dashboard to potentially render in a degraded state or show a specific error.
    return null;
  }
}
