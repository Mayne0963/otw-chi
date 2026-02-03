import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export default async function FranchiseApplyPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Apply for OTW Franchise" subtitle="Tell us about your city and plan." />
      <Card className="mt-3 space-y-3 p-5 sm:p-6">
        <form action={submitFranchiseApplication} className="space-y-3">
          <div>
            <label htmlFor="franchise-full-name" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Full Name</label>
            <input
              id="franchise-full-name"
              name="fullName"
              defaultValue={user.name ?? ''}
              className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2"
              required
            />
          </div>
          <div>
            <label htmlFor="franchise-email" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Email</label>
            <input
              id="franchise-email"
              name="email"
              type="email"
              defaultValue={user.email ?? ''}
              className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2"
              required
            />
          </div>
          <div>
            <label htmlFor="franchise-city-zones" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">City / Zones</label>
            <input
              id="franchise-city-zones"
              name="cityZones"
              className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2"
              required
            />
          </div>
          <div>
            <label htmlFor="franchise-why" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Why you?</label>
            <textarea
              id="franchise-why"
              name="message"
              className="w-full min-h-[120px] rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2"
            />
          </div>
          <Button variant="gold" className="w-full" type="submit">Submit Application</Button>
        </form>
      </Card>
    </OtwPageShell>
  );
}

export async function submitFranchiseApplication(formData: FormData) {
  'use server';
  const { getNeonSession } = await import('@/lib/auth/server');
  const session = await getNeonSession();
  // @ts-ignore
  const userId = session?.userId || session?.user?.id;
  if (!userId) return;

  const payload = {
    fullName: String(formData.get('fullName') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    cityZones: String(formData.get('cityZones') ?? '').trim(),
    message: String(formData.get('message') ?? '').trim(),
  };
  const parsed = z
    .object({
      fullName: z.string().min(2),
      email: z.string().email(),
      cityZones: z.string().min(2),
      message: z.string().optional(),
    })
    .safeParse(payload);
  if (!parsed.success) return;

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return;

  await prisma.franchiseApplication.create({
    data: {
      userId: user.id,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      cityZones: parsed.data.cityZones,
      message: parsed.data.message || null,
    },
  });

  revalidatePath('/franchise/apply');
}
