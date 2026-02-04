import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function DriverProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Driver Profile" subtitle="Update your info and zones." />
      <Card className="mt-3 space-y-3 p-5 sm:p-6">
        <form action={saveDriverProfile} className="space-y-3">
          <div>
            <label htmlFor="driver-display-name" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Display Name</label>
            <input
              id="driver-display-name"
              name="displayName"
              defaultValue={user.name ?? ''}
              className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2"
              required
            />
          </div>
          <Button variant="gold" type="submit">Save</Button>
        </form>
      </Card>
    </OtwPageShell>
  );
}

export async function saveDriverProfile(formData: FormData) {
  'use server';
  const { getNeonSession } = await import('@/lib/auth/server');
  const session = await getNeonSession();
  // @ts-ignore
  const userId = session?.userId || session?.user?.id;
  if (!userId) return;

  const displayName = String(formData.get('displayName') ?? '').trim();
  if (!displayName) return;

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { neonAuthId: userId } });
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { name: displayName },
  });

  revalidatePath('/driver/profile');
  revalidatePath('/driver/dashboard');
}
