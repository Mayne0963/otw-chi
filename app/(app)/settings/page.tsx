import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const prisma = getPrisma();
  const profile = user ? await prisma.customerProfile.findUnique({ where: { userId: user.id } }) : null;
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Settings" subtitle="Profile and addresses." />
      {!user ? (
        <OtwCard className="mt-3"><div className="text-sm">Please sign in.</div></OtwCard>
      ) : (
        <OtwCard className="mt-3 space-y-3">
          <form action={saveSettings} className="space-y-3">
            <input name="phone" defaultValue={profile?.phone ?? ''} className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Phone" />
            <input name="defaultPickup" defaultValue={profile?.defaultPickup ?? ''} className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Default Pickup" />
            <input name="defaultDropoff" defaultValue={profile?.defaultDropoff ?? ''} className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" placeholder="Default Dropoff" />
            <OtwButton variant="gold">Save</OtwButton>
          </form>
        </OtwCard>
      )}
    </OtwPageShell>
  );
}

export async function saveSettings(formData: FormData) {
  'use server';
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return;
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({ where: { clerkId: userId } });
  if (!user) return;
  const phone = String(formData.get('phone') ?? '');
  const defaultPickup = String(formData.get('defaultPickup') ?? '');
  const defaultDropoff = String(formData.get('defaultDropoff') ?? '');
  await prisma.customerProfile.upsert({
    where: { userId: user.id },
    update: { phone: phone || null, defaultPickup: defaultPickup || null, defaultDropoff: defaultDropoff || null },
    create: { userId: user.id, phone: phone || null, defaultPickup: defaultPickup || null, defaultDropoff: defaultDropoff || null },
  });
}
