import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import {
  closeTicketAction,
  reopenTicketAction,
  replyToTicketAction,
  resolveTicketAction,
} from '@/app/admin/support/actions';

export const dynamic = 'force-dynamic';

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['ADMIN']);
  const { id } = await params;
  const prisma = getPrisma();

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!ticket) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Support Ticket" subtitle="Ticket not found." />
        <OtwCard className="mt-4">
          <OtwEmptyState
            title="Ticket not found"
            subtitle="The ticket may have been removed or the ID is invalid."
            actionHref="/admin/support"
            actionLabel="Back to Support Desk"
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
        <OtwButton as="a" href="/admin/support" variant="outline" size="sm">
          Back to Support Desk
        </OtwButton>
      </div>

      <OtwCard className="mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/50">Subject</div>
            <div className="mt-1 text-lg font-semibold text-white">{ticket.subject}</div>
            <div className="mt-2 text-xs text-white/60">
              User: {ticket.user?.name || 'Unknown'} ({ticket.user?.email || 'no email'}) • {ticket.user?.role || 'UNKNOWN'}
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
            <div className="text-sm text-white/55">No message body on this ticket.</div>
          )}
        </div>
      </OtwCard>

      <OtwCard className="mt-4 p-5">
        <div className="text-sm font-semibold text-white">Respond to user</div>
        <form action={replyToTicketAction} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={ticket.id} />
          <textarea
            name="reply"
            className="min-h-[140px] w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            placeholder="Type your response for the user..."
            required
          />
          <div className="flex flex-wrap gap-2">
            <OtwButton type="submit" variant="gold" size="sm">
              Send Response
            </OtwButton>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {ticket.status !== 'RESOLVED' ? (
            <form action={resolveTicketAction}>
              <input type="hidden" name="id" value={ticket.id} />
              <OtwButton type="submit" variant="outline" size="sm" className="text-green-300 border-green-500/30 hover:bg-green-500/10">
                Mark Resolved
              </OtwButton>
            </form>
          ) : (
            <form action={reopenTicketAction}>
              <input type="hidden" name="id" value={ticket.id} />
              <OtwButton type="submit" variant="outline" size="sm" className="text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/10">
                Reopen
              </OtwButton>
            </form>
          )}
          {ticket.status !== 'CLOSED' ? (
            <form action={closeTicketAction}>
              <input type="hidden" name="id" value={ticket.id} />
              <OtwButton type="submit" variant="outline" size="sm" className="text-gray-300 border-gray-500/30 hover:bg-gray-500/10">
                Close Ticket
              </OtwButton>
            </form>
          ) : null}
        </div>
      </OtwCard>
    </OtwPageShell>
  );
}
