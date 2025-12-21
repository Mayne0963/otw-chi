import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const prisma = getPrisma();
  const profile = user ? await prisma.customerProfile.findUnique({ where: { userId: user.id } }) : null;
  // @ts-ignore: Prisma types not updating
  const dobString = user?.dob ? user.dob.toISOString().split('T')[0] : '';

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Settings" subtitle="Profile and addresses." />
      {!user ? (
        <OtwCard className="mt-3"><div className="text-sm">Please sign in.</div></OtwCard>
      ) : (
        <OtwCard className="mt-3 space-y-3">
          <form action={saveSettings} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Date of Birth (Required)</label>
              <input type="date" name="dob" defaultValue={dobString} className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 text-white placeholder-white/30" required />
            </div>
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
  const dobRaw = formData.get('dob');

  if (dobRaw) {
    const dobDate = new Date(String(dobRaw));
    if (!isNaN(dobDate.getTime())) {
       await prisma.user.update({
         where: { id: user.id },
         data: { dob: dobDate } as any
       });
    }
  }

  await prisma.customerProfile.upsert({
    where: { userId: user.id },
    update: { phone: phone || null, defaultPickup: defaultPickup || null, defaultDropoff: defaultDropoff || null },
    create: { userId: user.id, phone: phone || null, defaultPickup: defaultPickup || null, defaultDropoff: defaultDropoff || null },
  });
  
  // Revalidate to show updated data
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/settings');
  revalidatePath('/dashboard');
}
