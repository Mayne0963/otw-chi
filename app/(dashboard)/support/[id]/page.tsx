import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { formatDistanceToNow } from 'date-fns';
import { replyToOwnTicketAction } from '@/app/(dashboard)/support/actions';

export const dynamic = 'force-dynamic';

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Support Ticket" subtitle="Please sign in to view your support messages." />
        <OtwCard className="mt-4">
          <OtwEmptyState title="Sign in required" subtitle="Please sign in to continue." />
        </OtwCard>
      </OtwPageShell>
    );
  }

  const { id } = await params;
  const prisma = getPrisma();
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
      subject: true,
      message: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!ticket) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Support Ticket" subtitle="Ticket not found." />
        <OtwCard className="mt-4">
          <OtwEmptyState
            title="Ticket not found"
            subtitle="You can only view your own support tickets."
            actionHref="/support"
            actionLabel="Back to Support"
          />
        </OtwCard>
      </OtwPageShell>
    );
  }

  const statusClass =
    ticket.status === 'OPEN'
      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
      : ticket.status === 'RESOLVED'
      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
      : 'bg-gray-500/20 text-gray-300 border border-gray-500/30';

  return (
    <OtwPageShell>
      <div className="flex items-center justify-between gap-3">
        <OtwSectionHeader
          title={`Support Ticket ${ticket.id.slice(-8).toUpperCase()}`}
          subtitle={`Opened ${formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}`}
        />
        <OtwButton as="a" href="/support" variant="outline" size="sm">
          Back to Support
        </OtwButton>
      </div>

      <OtwCard className="mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/50">Subject</div>
            <div className="mt-1 text-lg font-semibold text-white">{ticket.subject}</div>
            <div className="mt-2 text-xs text-white/60">
              Updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
            </div>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
            {ticket.status}
          </span>
        </div>
      </OtwCard>

      <OtwCard className="mt-4 p-5">
        <div className="text-xs uppercase tracking-wide text-white/50">Conversation</div>
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-4">
          {ticket.message ? (
            <pre className="whitespace-pre-wrap text-sm text-white/85">{ticket.message}</pre>
          ) : (
            <div className="text-sm text-white/55">No messages yet.</div>
          )}
        </div>
      </OtwCard>

      <OtwCard className="mt-4 p-5">
        <div className="text-sm font-semibold text-white">Send a message</div>
        {ticket.status === 'OPEN' ? (
          <>
            <form action={replyToOwnTicketAction} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={ticket.id} />
              <textarea
                name="reply"
                className="min-h-[140px] w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                placeholder="Type your message for support..."
                required
              />
              <div className="flex flex-wrap gap-2">
                <OtwButton type="submit" variant="gold" size="sm">
                  Send Message
                </OtwButton>
              </div>
            </form>
            <div className="mt-2 text-xs text-white/55">
              Sending a message will keep this ticket open for support follow-up.
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white/70">
            This ticket is {ticket.status.toLowerCase()}. Messaging is disabled.
          </div>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}
