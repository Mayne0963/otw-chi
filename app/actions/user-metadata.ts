'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { getActiveSubscription, getPlanCodeFromSubscription } from '@/lib/membership';

export async function syncUserMetadataFromDb() {
  'use server';
  const { userId } = await auth();
  if (!userId) return null;
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { clerkId: userId },
    include: { driverProfile: { include: { zone: true } }, franchiseProfile: true }
  });
  if (!user) return null;
  const sub = await getActiveSubscription(user.id);
  const planCode = getPlanCodeFromSubscription(sub);
  let tier = 'basic';
  if (planCode === 'PLUS') tier = 'broski+';
  if (planCode === 'EXEC') tier = 'executive';
  const zoneName = user.driverProfile?.zone?.name?.toLowerCase() ?? 'unassigned';
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const pm = (clerkUser.publicMetadata || {}) as Record<string, unknown>;
  const payload = {
    otw_role: user.role.toLowerCase(),
    otw_tier: tier,
    nip_wallet_id: (pm.nip_wallet_id as string) ?? 'pending',
    franchise_level: (pm.franchise_level as string) ?? 'seed',
    otw_zone: zoneName,
    role: user.role
  };
  await client.users.updateUser(userId, { publicMetadata: { ...pm, ...payload } });
  return payload;
}

