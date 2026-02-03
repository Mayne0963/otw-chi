import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
        <Card className="mt-3 p-5 sm:p-6"><div className="text-sm">Please sign in.</div></Card>
      ) : (
        <Card className="mt-3 space-y-3 p-5 sm:p-6">
          <form action={saveSettings} className="space-y-3">
            <div>
              <label htmlFor="settings-dob" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Date of Birth (Required)</label>
              <input id="settings-dob" type="date" name="dob" defaultValue={dobString} className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2 text-white" required />
            </div>
            <div>
              <label htmlFor="settings-phone" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Phone</label>
              <input id="settings-phone" name="phone" defaultValue={profile?.phone ?? ''} className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" />
            </div>
            <div>
              <label htmlFor="settings-default-pickup" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Default Pickup</label>
              <input id="settings-default-pickup" name="defaultPickup" defaultValue={profile?.defaultPickup ?? ''} className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" />
            </div>
            <div>
              <label htmlFor="settings-default-dropoff" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Default Dropoff</label>
              <input id="settings-default-dropoff" name="defaultDropoff" defaultValue={profile?.defaultDropoff ?? ''} className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" />
            </div>
            <Button variant="gold" type="submit">Save</Button>
          </form>
        </Card>
      )}
    </OtwPageShell>
  );
}

export async function saveSettings(formData: FormData) {
  'use server';
  const { getNeonSession } = await import('@/lib/auth/server');
  const session = await getNeonSession();
  // @ts-ignore
  const userId = session?.userId || session?.user?.id;
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
         data: { dob: dobDate }
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
