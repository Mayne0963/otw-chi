import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const user = await getCurrentUser();
  const prisma = getPrisma();
  const tickets = user ? await prisma.supportTicket.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }) : [];
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Support" subtitle="Create a ticket or get help." />
      {!user ? (
        <OtwCard className="mt-3"><div className="text-sm">Please sign in.</div></OtwCard>
      ) : (
        <>
          <OtwCard className="mt-3 space-y-3">
            <form action={createTicketAction} className="space-y-3">
              <div>
                <label htmlFor="support-subject" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Subject</label>
                <input id="support-subject" name="subject" className="w-full rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" />
              </div>
              <div>
                <label htmlFor="support-message" className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1 block">Message</label>
                <textarea id="support-message" name="message" className="w-full min-h-[120px] rounded-xl bg-otwBlack/40 border border-white/15 px-3 py-2" />
              </div>
              <OtwButton variant="gold" type="submit">Submit Ticket</OtwButton>
            </form>
          </OtwCard>
          <OtwCard className="mt-3">
            <div className="text-sm font-medium">My Tickets</div>
            {tickets.length === 0 ? (
              <OtwEmptyState title="No tickets" subtitle="Create a support ticket above." />
            ) : (
              <ul className="mt-2 space-y-2">
                {tickets.map(t => (
                  <li key={t.id} className="text-sm opacity-90">
                    <div className="flex items-center justify-between">
                      <div>{t.subject}</div>
                      <div className="opacity-80">{t.status}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </OtwCard>
        </>
      )}
    </OtwPageShell>
  );
}

export async function createTicketAction(formData: FormData) {
  'use server';
  const { getNeonSession } = await import('@/lib/auth/server');
  const session = await getNeonSession();
  // @ts-ignore
  const userId = session?.userId || session?.user?.id;
  if (!userId) return;
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({ where: { clerkId: userId } });
  if (!user) return;
  const subject = String(formData.get('subject') ?? '');
  const message = String(formData.get('message') ?? '');
  if (!subject || !message) return;
  await prisma.supportTicket.create({ data: { userId: user.id, subject, message } });
  
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/support');
}
