import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Contact OTW" subtitle="Reach the team for support or ops." />
      <OtwCard className="mt-3 space-y-3">
        <form action={submitContactMessage} className="space-y-3">
          <div>
            <label htmlFor="contact-email" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Email</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              defaultValue={user?.email ?? ''}
              className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2"
              required
            />
          </div>
          <div>
            <label htmlFor="contact-message" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Message</label>
            <textarea
              id="contact-message"
              name="message"
              className="w-full min-h-[120px] rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2"
              required
            />
          </div>
          <OtwButton variant="gold" className="w-full" type="submit">Send</OtwButton>
        </form>
      </OtwCard>
    </OtwPageShell>
  );
}

export async function submitContactMessage(formData: FormData) {
  'use server';
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();

  const payload = {
    email: String(formData.get('email') ?? '').trim(),
    message: String(formData.get('message') ?? '').trim(),
  };
  const parsed = z
    .object({
      email: z.string().email(),
      message: z.string().min(2),
    })
    .safeParse(payload);
  if (!parsed.success) return;

  const prisma = getPrisma();
  let dbUserId: string | null = null;
  if (userId) {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    dbUserId = user?.id ?? null;
  }

  await prisma.contactMessage.create({
    data: {
      userId: dbUserId ?? undefined,
      email: parsed.data.email,
      message: parsed.data.message,
    },
  });

  revalidatePath('/contact');
}
