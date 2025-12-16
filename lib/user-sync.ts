import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

export async function syncUserOnDashboard() {
  const { userId } = await auth();
  if (!userId) return null;
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
  const name = clerkUser.firstName && clerkUser.lastName ? `${clerkUser.firstName} ${clerkUser.lastName}` : clerkUser.username || email;
  const roleMeta = String(clerkUser.publicMetadata?.role || 'CUSTOMER').toUpperCase();
  const role = roleMeta === 'DRIVER' || roleMeta === 'ADMIN' || roleMeta === 'FRANCHISE' ? roleMeta : 'CUSTOMER';
  const prisma = getPrisma();
  const user = await prisma.user.upsert({
    where: { clerkId: userId },
    update: { email, name, role },
    create: { clerkId: userId, email, name, role },
  });
  await prisma.customerProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  return user;
}
