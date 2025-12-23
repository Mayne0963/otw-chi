import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';
import { formatDistanceToNow } from 'date-fns';

// Loading component for better UX
function AdminNipLedgerLoading() {
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

async function getNipLedgerData() {
  const prisma = getPrisma();
  
  try {
    // Get all NIP ledger entries with user details
    const ledgerEntries = await prisma.nIPLedger.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Get ledger statistics
    const stats = await prisma.nIPLedger.aggregate({
      _sum: { amount: true },
      _count: true
    });

    const totalIssued = stats._sum.amount || 0;
    const totalTransactions = stats._count || 0;

    // Group by transaction type
    const byType = await prisma.nIPLedger.groupBy({
      by: ['type'],
      _sum: { amount: true },
      _count: true
    });

    return { ledgerEntries, totalIssued, totalTransactions, byType };
  } catch (error) {
    console.error('[AdminNipLedger] Failed to fetch ledger entries:', error);
    throw error;
  }
}

async function NipLedgerList() {
  let ledgerEntries: any[] = [];
  let totalIssued = 0;
  let totalTransactions = 0;
  let byType: any[] = [];
  let error: unknown = null;

  try {
    const data = await getNipLedgerData();
    ledgerEntries = data.ledgerEntries;
    totalIssued = data.totalIssued;
    totalTransactions = data.totalTransactions;
    byType = data.byType;
  } catch (err) {
    error = err;
  }

  if (error) {
    return <NipLedgerErrorState error={error} />;
  }

  if (ledgerEntries.length === 0) {
    return <EmptyNipLedgerState totalTransactions={totalTransactions} totalIssued={totalIssued} byType={byType} />;
  }

  return <NipLedgerContent ledgerEntries={ledgerEntries} totalTransactions={totalTransactions} totalIssued={totalIssued} byType={byType} />;
}

function EmptyNipLedgerState({ totalTransactions, totalIssued, byType }: { totalTransactions: number; totalIssued: number; byType: any[] }) {
  return (
    <>
      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-otwGold">{totalTransactions}</div>
            <div className="text-xs text-white/60">Total Transactions</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{totalIssued}</div>
            <div className="text-xs text-white/60">Total TIREM Issued</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">
              {byType.find(t => t.type === 'COMPLETION_REWARD')?._count || 0}
            </div>
            <div className="text-xs text-white/60">Completion Rewards</div>
          </div>
        </div>
      </OtwCard>
      
      <OtwCard className="mt-3 p-8 text-center">
        <OtwEmptyState 
          title="No TIREM transactions found" 
          subtitle="TIREM transactions will appear here when users earn or redeem points." 
        />
      </OtwCard>
    </>
  );
}

function NipLedgerContent({ ledgerEntries, totalTransactions, totalIssued, byType }: { ledgerEntries: any[]; totalTransactions: number; totalIssued: number; byType: any[] }) {
  return (
    <>
      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-otwGold">{totalTransactions}</div>
            <div className="text-xs text-white/60">Total Transactions</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{totalIssued}</div>
            <div className="text-xs text-white/60">Total TIREM Issued</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">
              {byType.find(t => t.type === 'COMPLETION_REWARD')?._count || 0}
            </div>
            <div className="text-xs text-white/60">Completion Rewards</div>
          </div>
        </div>
      </OtwCard>

      <OtwCard className="mt-3">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="opacity-60 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Request</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{entry.user.name || 'Unknown User'}</div>
                      <div className="text-xs text-white/50">{entry.user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      entry.type === 'COMPLETION_REWARD'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : entry.type === 'REFERRAL_BONUS'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : entry.type === 'PROMOTION'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {entry.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-otwGold">
                    +{entry.amount} TIREM
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {entry.requestId ? (
                      <div className="text-xs">
                        Request: {entry.requestId}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors">
                        View
                      </button>
                      <button className="text-xs px-2 py-1 rounded bg-otwGold/20 hover:bg-otwGold/30 text-otwGold transition-colors">
                        Details
                      </button>
                    </div>
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

function NipLedgerErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load TIREM ledger</div>
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

export default async function AdminNipLedgerPage() {
  await requireRole(['ADMIN']);
  
  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="TIREM Ledger Management" 
        subtitle="Monitor all TIREM transactions, rewards, and point distributions." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminNipLedgerLoading />}>
          <NipLedgerList />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}