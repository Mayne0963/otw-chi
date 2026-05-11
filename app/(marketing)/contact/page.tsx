import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import OtwSessionIdField from '@/components/analytics/OtwSessionIdField';

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Contact OTW" subtitle="Reach the team for support or ops." />
      <Card className="mt-3 space-y-3 p-5 sm:p-6">
        <form action={submitContactMessage} className="space-y-3">
          <OtwSessionIdField name="otwSessionId" />
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
          <Button variant="gold" className="w-full" type="submit">Send</Button>
        </form>
      </Card>
    </OtwPageShell>
  );
}

export async function submitContactMessage(formData: FormData) {
  'use server';
  const currentUser = await getCurrentUser();

  const sessionId = String(formData.get('otwSessionId') ?? '').trim();
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
  const dbUserId = currentUser?.id ?? null;

  await prisma.contactMessage.create({
    data: {
      userId: dbUserId ?? undefined,
      email: parsed.data.email,
      message: parsed.data.message,
    },
  });

  if (sessionId.length >= 8) {
    const customerProfile = dbUserId
      ? await prisma.customerProfile
          .findUnique({ where: { userId: dbUserId }, select: { id: true } })
          .catch(() => null)
      : null;

    prisma.otwSiteEvent
      .create({
        data: {
          sessionId,
          userId: dbUserId ?? undefined,
          customerProfileId: customerProfile?.id ?? undefined,
          eventType: 'CONTACT_SUBMITTED',
          page: '/contact',
          metadata: {
            kind: 'contact_message',
          },
        },
      })
      .catch(() => null);
  }

  prisma.otwLead
    .create({
      data: {
        name: currentUser?.name?.trim() || undefined,
        email: parsed.data.email,
        interestType: 'GENERAL_CONTACT',
        sourcePage: '/contact',
        message: parsed.data.message,
      },
      select: { id: true },
    })
    .catch(() => null);

  revalidatePath('/contact');
}
