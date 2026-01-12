import OtwButton from '@/components/ui/otw/OtwButton';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';

// Loading component for better UX
function AdminSettingsLoading() {
  return (
    <OtwCard className="mt-3">
      <div className="animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-12 bg-white/5 rounded"></div>
          ))}
        </div>
      </div>
    </OtwCard>
  );
}

async function getSystemStats() {
  const prisma = getPrisma();
  
  try {
    // Get system-wide statistics
    const [
      totalUsers,
      totalDrivers,
      totalRequests,
      totalCities,
      totalZones,
      totalMemberships,
      totalTickets,
      membershipPlans
    ] = await Promise.all([
      prisma.user.count(),
      prisma.driverProfile.count(),
      prisma.request.count(),
      prisma.city.count(),
      prisma.zone.count(),
      prisma.membershipSubscription.count({ where: { status: 'ACTIVE' } }),
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      prisma.membershipPlan.findMany({
        select: { id: true, name: true, description: true, stripePriceId: true }
      })
    ]);

    // Get request status breakdown
    const requestsByStatus = await prisma.request.groupBy({
      by: ['status'],
      _count: true
    });

    // Get user role breakdown
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true
    });

    return {
      totalUsers,
      totalDrivers,
      totalRequests,
      totalCities,
      totalZones,
      totalMemberships,
      totalTickets,
      membershipPlans,
      requestsByStatus,
      usersByRole
    };
  } catch (error) {
    console.error('[AdminSettings] Failed to fetch system stats:', error);
    throw error;
  }
}

async function SystemSettings() {
  let stats: any = null;
  let error: unknown = null;

  try {
    stats = await getSystemStats();
  } catch (err) {
    error = err;
  }

  if (error) {
    return <SettingsErrorState error={error} />;
  }

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <OtwCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">System Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white/5 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
            <div className="text-xs text-white/60">Total Users</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-400">{stats.totalDrivers}</div>
            <div className="text-xs text-white/60">Active Drivers</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.totalRequests}</div>
            <div className="text-xs text-white/60">Total Requests</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg text-center">
            <div className="text-2xl font-bold text-otwGold">{stats.totalMemberships}</div>
            <div className="text-xs text-white/60">Active Memberships</div>
          </div>
        </div>
      </OtwCard>

      {/* User Breakdown */}
      <OtwCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Users by Role</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.usersByRole.map((role: any) => (
            <div key={role.role} className="p-4 bg-white/5 rounded-lg text-center">
              <div className="text-2xl font-bold text-white">{role._count}</div>
              <div className="text-xs text-white/60">{role.role}</div>
            </div>
          ))}
        </div>
      </OtwCard>

      {/* Request Status Breakdown */}
      <OtwCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Requests by Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.requestsByStatus.map((status: any) => (
            <div key={status.status} className="p-4 bg-white/5 rounded-lg text-center">
              <div className={`text-2xl font-bold ${
                status.status === 'COMPLETED' ? 'text-green-400' :
                status.status === 'PENDING' || status.status === 'DRAFT' ? 'text-yellow-400' :
                status.status === 'CANCELLED' ? 'text-red-400' :
                'text-blue-400'
              }`}>
                {status._count}
              </div>
              <div className="text-xs text-white/60">{status.status.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      </OtwCard>

      {/* Coverage Areas */}
      <OtwCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Coverage Areas</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg text-center">
            <div className="text-2xl font-bold text-otwGold">{stats.totalCities}</div>
            <div className="text-xs text-white/60">Active Cities</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.totalZones}</div>
            <div className="text-xs text-white/60">Total Zones</div>
          </div>
        </div>
      </OtwCard>

      {/* Membership Plans */}
      <OtwCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Membership Plans</h3>
        {stats.membershipPlans.length === 0 ? (
          <div className="text-center py-4 text-white/50">
            No membership plans configured
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="opacity-60 border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-2">Plan Name</th>
                  <th className="text-left px-4 py-2">Description</th>
                  <th className="text-left px-4 py-2">Stripe Price ID</th>
                  <th className="text-left px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.membershipPlans.map((plan: any) => (
                  <tr key={plan.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-2 font-medium">{plan.name}</td>
                    <td className="px-4 py-2 text-white/70">{plan.description || '-'}</td>
                    <td className="px-4 py-2 text-white/50 text-xs font-mono">
                      {plan.stripePriceId || 'Not configured'}
                    </td>
                    <td className="px-4 py-2">
                      <OtwButton variant="ghost" className="text-xs px-2 py-1 h-auto text-otwGold hover:bg-otwGold/20 hover:text-otwGold">
                        Edit
                      </OtwButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OtwCard>

      {/* Support Status */}
      <OtwCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Support Status</h3>
        <div className="p-4 bg-white/5 rounded-lg text-center">
          <div className={`text-2xl font-bold ${stats.totalTickets > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {stats.totalTickets}
          </div>
          <div className="text-xs text-white/60">Open Support Tickets</div>
        </div>
      </OtwCard>

      {/* Database Info */}
      <OtwCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Database Configuration</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between p-3 bg-white/5 rounded">
            <span className="text-white/60">Provider</span>
            <span className="text-white font-medium">PostgreSQL (Neon)</span>
          </div>
          <div className="flex justify-between p-3 bg-white/5 rounded">
            <span className="text-white/60">ORM</span>
            <span className="text-white font-medium">Prisma 7</span>
          </div>
          <div className="flex justify-between p-3 bg-white/5 rounded">
            <span className="text-white/60">Connection</span>
            <span className="text-green-400 font-medium">Connected</span>
          </div>
        </div>
      </OtwCard>
    </div>
  );
}

function SettingsErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load system settings</div>
      <div className="text-xs text-white/40 mt-2">
        {error instanceof Error ? error.message : 'Unknown error occurred'}
      </div>
      <OtwButton 
        onClick={() => window.location.reload()} 
        variant="outline"
        className="mt-4 h-8 text-xs"
      >
        Retry
      </OtwButton>
    </OtwCard>
  );
}

export default async function AdminSettingsPage() {
  await requireRole(['ADMIN']);
  
  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="System Settings" 
        subtitle="View system configuration and statistics." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminSettingsLoading />}>
          <SystemSettings />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}
