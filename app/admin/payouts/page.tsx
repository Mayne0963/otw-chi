import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';
import { formatDistanceToNow } from 'date-fns';

// Loading component for better UX
function AdminPayoutsLoading() {
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

async function getPayoutsData() {
  const prisma = getPrisma();
  
  try {
    // Get all payout-related support tickets with better filtering
    const payouts = await prisma.supportTicket.findMany({
      where: { 
        subject: { contains: 'payout', mode: 'insensitive' }
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Get driver earnings summary for context
    const pendingEarnings = await prisma.driverEarnings.aggregate({
      where: { status: 'pending' },
      _sum: { amount: true },
      _count: true
    });

    const totalPending = pendingEarnings._sum.amount || 0;
    const totalPendingCount = pendingEarnings._count || 0;

    return { payouts, totalPending, totalPendingCount };
  } catch (error) {
    console.error('[AdminPayouts] Failed to fetch payouts:', error);
    throw error;
  }
}

async function PayoutsList() {
  let payouts: any[] = [];
  let totalPending = 0;
  let totalPendingCount = 0;
  let error: unknown = null;

  try {
    const data = await getPayoutsData();
    payouts = data.payouts;
    totalPending = data.totalPending;
    totalPendingCount = data.totalPendingCount;
  } catch (err) {
    error = err;
  }

  if (error) {
    return <PayoutsErrorState error={error} />;
  }

  if (payouts.length === 0 && totalPendingCount === 0) {
    return <EmptyPayoutsState totalPending={totalPending} totalPendingCount={totalPendingCount} />;
  }

  return <PayoutsContent payouts={payouts} totalPending={totalPending} totalPendingCount={totalPendingCount} />;
}

function EmptyPayoutsState({ totalPending, totalPendingCount }: { totalPending: number; totalPendingCount: number }) {
  return (
    <>
      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">${(totalPending / 100).toFixed(2)}</div>
            <div className="text-xs text-white/60">Total Pending</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{totalPendingCount}</div>
            <div className="text-xs text-white/60">Pending Requests</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">0</div>
            <div className="text-xs text-white/60">Processed Today</div>
          </div>
        </div>
      </OtwCard>
      
      <OtwCard className="mt-3 p-8 text-center">
        <OtwEmptyState 
          title="No payout requests" 
          subtitle="Driver payout requests will appear here when submitted." 
        />
      </OtwCard>
    </>
  );
}

function PayoutsContent({ payouts, totalPending, totalPendingCount }: { payouts: any[]; totalPending: number; totalPendingCount: number }) {
  return (
    <>
      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">${(totalPending / 100).toFixed(2)}</div>
            <div className="text-xs text-white/60">Total Pending</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{totalPendingCount}</div>
            <div className="text-xs text-white/60">Pending Requests</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{payouts.filter(p => p.status === 'RESOLVED').length}</div>
            <div className="text-xs text-white/60">Processed</div>
          </div>
        </div>
      </OtwCard>

      <OtwCard className="mt-3">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="opacity-60 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Driver</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Message</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {formatDistanceToNow(new Date(payout.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{payout.user?.name || 'Unknown Driver'}</div>
                      <div className="text-xs text-white/50">{payout.user?.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      payout.status === 'OPEN'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : payout.status === 'RESOLVED'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {payout.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-sm">{payout.subject}</td>
                  <td className="px-4 py-3 text-white/70 text-sm max-w-xs truncate" title={payout.message || ''}>
                    {payout.message || 'No message provided'}
                  </td>
                  <td className="px-4 py-3">
                    {payout.status !== 'RESOLVED' && (
                      <form action={resolvePayoutAction}>
                        <input type="hidden" name="id" value={payout.id} />
                        <button 
                          type="submit"
                          className="text-xs px-2 py-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-colors"
                        >
                          Mark Resolved
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OtwCard>
    </>
  );
}

function PayoutsErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load payout requests</div>
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

export async function resolvePayoutAction(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  
  if (!id) {
    console.warn('[resolvePayoutAction] Missing payout ID');
    return;
  }
  
  try {
    const prisma = getPrisma();
    
    // Update the support ticket status
    await prisma.supportTicket.update({
      where: { id },
      data: { 
        status: 'RESOLVED',
        message: (await prisma.supportTicket.findUnique({
          where: { id },
          select: { message: true }
        }))?.message + '\n\n[RESOLVED BY ADMIN]'
      },
    });
    
    console.log('[resolvePayoutAction] Successfully resolved payout:', id);
    
  } catch (error) {
    console.error('[resolvePayoutAction] Failed to resolve payout:', error);
    throw error; // Re-throw to trigger error boundary
  }
}

export default async function AdminPayoutsPage() {
  await requireRole(['ADMIN']);
  
  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Driver Payout Management" 
        subtitle="Review and process driver payout requests and earnings." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminPayoutsLoading />}>
          <PayoutsList />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}