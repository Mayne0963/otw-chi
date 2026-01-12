import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';
import { formatDistanceToNow } from 'date-fns';

// Loading component for better UX
function AdminMembershipsLoading() {
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

async function getMembershipsData() {
  const prisma = getPrisma();
  
  try {
    // Get all membership subscriptions with user and plan details
    const memberships = await prisma.membershipSubscription.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true, description: true } }
      },
      take: 50
    });

    // Get membership statistics
    const stats = await prisma.membershipSubscription.groupBy({
      by: ['status'],
      _count: true
    });

    const totalActive = stats.find(s => s.status === 'ACTIVE')?._count || 0;
    const totalCancelled = stats.find(s => s.status === 'CANCELED')?._count || 0;
    const totalPastDue = stats.find(s => s.status === 'PAST_DUE')?._count || 0;

    return { memberships, totalActive, totalCancelled, totalPastDue };
  } catch (error) {
    console.error('[AdminMemberships] Failed to fetch memberships:', error);
    throw error;
  }
}

async function MembershipsList() {
  let memberships: any[] = [];
  let totalActive = 0;
  let totalCancelled = 0;
  let totalPastDue = 0;
  let error: unknown = null;

  try {
    const data = await getMembershipsData();
    memberships = data.memberships;
    totalActive = data.totalActive;
    totalCancelled = data.totalCancelled;
    totalPastDue = data.totalPastDue;
  } catch (err) {
    error = err;
  }

  if (error) {
    return <MembershipsErrorState error={error} />;
  }

  if (memberships.length === 0) {
    return <EmptyMembershipsState totalActive={totalActive} totalCancelled={totalCancelled} totalPastDue={totalPastDue} totalSubscriptions={memberships.length} />;
  }

  return <MembershipsContent memberships={memberships} totalActive={totalActive} totalCancelled={totalCancelled} totalPastDue={totalPastDue} />;
}

function EmptyMembershipsState({ totalActive, totalCancelled, totalPastDue, totalSubscriptions }: { totalActive: number; totalCancelled: number; totalPastDue: number; totalSubscriptions: number }) {
  return (
    <>
      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{totalActive}</div>
            <div className="text-xs text-white/60">Active Members</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-red-400">{totalCancelled}</div>
            <div className="text-xs text-white/60">Cancelled</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{totalPastDue}</div>
            <div className="text-xs text-white/60">Past Due</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{totalSubscriptions}</div>
            <div className="text-xs text-white/60">Total Subscriptions</div>
          </div>
        </div>
      </OtwCard>
      
      <OtwCard className="mt-3 p-8 text-center">
        <OtwEmptyState 
          title="No membership subscriptions found" 
          subtitle="Membership subscriptions will appear here when users subscribe to plans." 
        />
      </OtwCard>
    </>
  );
}

function MembershipsContent({ memberships, totalActive, totalCancelled, totalPastDue }: { memberships: any[]; totalActive: number; totalCancelled: number; totalPastDue: number }) {
  return (
    <>
      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{totalActive}</div>
            <div className="text-xs text-white/60">Active Members</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-red-400">{totalCancelled}</div>
            <div className="text-xs text-white/60">Cancelled</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{totalPastDue}</div>
            <div className="text-xs text-white/60">Past Due</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{memberships.length}</div>
            <div className="text-xs text-white/60">Total Subscriptions</div>
          </div>
        </div>
      </OtwCard>

      <OtwCard className="mt-3">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="opacity-60 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3">Member</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Period End</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{membership.user.name || 'Unknown Member'}</div>
                      <div className="text-xs text-white/50">{membership.user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-sm">{membership.plan.name}</div>
                      <div className="text-xs text-white/50">{membership.plan.description}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      membership.status === 'ACTIVE' 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : membership.status === 'CANCELLED'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : membership.status === 'PAST_DUE'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {membership.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {membership.currentPeriodEnd 
                      ? formatDistanceToNow(new Date(membership.currentPeriodEnd), { addSuffix: true })
                      : 'N/A'
                    }
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {formatDistanceToNow(new Date(membership.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <OtwButton variant="ghost" className="text-xs px-2 py-1 h-auto bg-white/10 hover:bg-white/20">
                        View
                      </OtwButton>
                      <OtwButton variant="ghost" className="text-xs px-2 py-1 h-auto bg-otwGold/20 hover:bg-otwGold/30 text-otwGold">
                        Manage
                      </OtwButton>
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

function MembershipsErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load memberships</div>
      <div className="text-xs text-white/40 mt-2">
        {error instanceof Error ? error.message : 'Unknown error occurred'}
      </div>
      <OtwButton 
        onClick={() => window.location.reload()} 
        variant="ghost"
        className="mt-4 text-xs px-3 py-2 h-auto bg-white/10 hover:bg-white/20"
      >
        Retry
      </OtwButton>
    </OtwCard>
  );
}

export default async function AdminMembershipsPage() {
  await requireRole(['ADMIN']);
  
  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Membership Management" 
        subtitle="Monitor subscription plans, member activity, and billing status." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminMembershipsLoading />}>
          <MembershipsList />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}