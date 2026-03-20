import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { formatDistanceToNow } from 'date-fns';
import { createTicketAction } from '@/app/(dashboard)/support/actions';

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
                  <li key={t.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm opacity-90">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-white">{t.subject}</div>
                        <div className="text-xs text-white/50">
                          Updated {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-full border border-white/15 px-2 py-0.5 text-xs uppercase tracking-wide text-white/70">
                          {t.status}
                        </div>
                        <OtwButton as="a" href={`/support/${t.id}`} variant="outline" size="sm" className="h-7 px-2 text-xs">
                          Open
                        </OtwButton>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-white/60">
                      Ticket ID: {t.id.slice(-8).toUpperCase()}
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
