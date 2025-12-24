import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';
import { formatDistanceToNow } from 'date-fns';

// Loading component for better UX
function AdminSupportLoading() {
  return (
    <OtwCard className="mt-3">
      <div className="animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded"></div>
          ))}
        </div>
      </div>
    </OtwCard>
  );
}

async function getSupportData() {
  const prisma = getPrisma();
  
  try {
    // Get all support tickets with user details
    const tickets = await prisma.supportTicket.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Get ticket statistics
    const stats = await prisma.supportTicket.groupBy({
      by: ['status'],
      _count: true
    });

    const openCount = stats.find(s => s.status === 'OPEN')?._count || 0;
    const resolvedCount = stats.find(s => s.status === 'RESOLVED')?._count || 0;
    const closedCount = stats.find(s => s.status === 'CLOSED')?._count || 0;
    const totalCount = tickets.length;

    return { tickets, openCount, resolvedCount, closedCount, totalCount };
  } catch (error) {
    console.error('[AdminSupport] Failed to fetch support tickets:', error);
    throw error;
  }
}

async function SupportList() {
  let tickets: any[] = [];
  let openCount = 0;
  let resolvedCount = 0;
  let closedCount = 0;
  let totalCount = 0;
  let error: unknown = null;

  try {
    const data = await getSupportData();
    tickets = data.tickets;
    openCount = data.openCount;
    resolvedCount = data.resolvedCount;
    closedCount = data.closedCount;
    totalCount = data.totalCount;
  } catch (err) {
    error = err;
  }

  if (error) {
    return <SupportErrorState error={error} />;
  }

  return (
    <>
      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{openCount}</div>
            <div className="text-xs text-white/60">Open Tickets</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{resolvedCount}</div>
            <div className="text-xs text-white/60">Resolved</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-gray-400">{closedCount}</div>
            <div className="text-xs text-white/60">Closed</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{totalCount}</div>
            <div className="text-xs text-white/60">Total Tickets</div>
          </div>
        </div>
      </OtwCard>

      {tickets.length === 0 ? (
        <OtwCard className="mt-3 p-8 text-center">
          <OtwEmptyState 
            title="No support tickets" 
            subtitle="Support tickets will appear here when users submit them." 
          />
        </OtwCard>
      ) : (
        <SupportTable tickets={tickets} />
      )}
    </>
  );
}

function SupportTable({ tickets }: { tickets: any[] }) {
  return (
    <OtwCard className="mt-3">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="opacity-60 border-b border-white/10">
            <tr>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Subject</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Message</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-white/60 text-xs">
                  {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium">{ticket.user?.name || 'Unknown User'}</div>
                    <div className="text-xs text-white/50">{ticket.user?.email}</div>
                    <div className="text-xs text-white/40">{ticket.user?.role}</div>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-sm">{ticket.subject}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    ticket.status === 'OPEN'
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : ticket.status === 'RESOLVED'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {ticket.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/70 text-sm max-w-xs truncate" title={ticket.message || ''}>
                  {ticket.message || 'No message provided'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {ticket.status === 'OPEN' && (
                      <form action={resolveTicketAction}>
                        <input type="hidden" name="id" value={ticket.id} />
                        <button 
                          type="submit"
                          className="text-xs px-2 py-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-colors"
                        >
                          Resolve
                        </button>
                      </form>
                    )}
                    {ticket.status !== 'CLOSED' && (
                      <form action={closeTicketAction}>
                        <input type="hidden" name="id" value={ticket.id} />
                        <button 
                          type="submit"
                          className="text-xs px-2 py-1 rounded bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 border border-gray-500/30 transition-colors"
                        >
                          Close
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OtwCard>
  );
}

function SupportErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load support tickets</div>
      <div className="text-xs text-white/40 mt-2">
        {error instanceof Error ? error.message : 'Unknown error occurred'}
      </div>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-4 text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
      >
        Retry
      </button>
    </OtwCard>
  );
}

export async function resolveTicketAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  
  if (!id) {
    console.warn('[resolveTicketAction] Missing ticket ID');
    return;
  }
  
  try {
    const prisma = getPrisma();
    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'RESOLVED' }
    });
    console.log('[resolveTicketAction] Successfully resolved ticket:', id);
  } catch (error) {
    console.error('[resolveTicketAction] Failed to resolve ticket:', error);
    throw error;
  }
}

export async function closeTicketAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  
  if (!id) {
    console.warn('[closeTicketAction] Missing ticket ID');
    return;
  }
  
  try {
    const prisma = getPrisma();
    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'CLOSED' }
    });
    console.log('[closeTicketAction] Successfully closed ticket:', id);
  } catch (error) {
    console.error('[closeTicketAction] Failed to close ticket:', error);
    throw error;
  }
}

export default async function AdminSupportPage() {
  await requireRole(['ADMIN']);
  
  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Support Ticket Management" 
        subtitle="Review and manage customer support tickets." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminSupportLoading />}>
          <SupportList />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}
