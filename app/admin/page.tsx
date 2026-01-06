import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';

// Loading component for better UX
function AdminOverviewLoading() {
  return (
    <div className="mt-3 grid md:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => (
        <OtwCard key={i}>
          <div className="animate-pulse">
            <div className="h-4 bg-muted/40 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-muted/20 rounded w-1/2"></div>
          </div>
        </OtwCard>
      ))}
    </div>
  );
}

async function getAdminStats() {
  const prisma = getPrisma();
  
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get comprehensive statistics with error handling
    const [
      requestsToday,
      activeDrivers,
      openTickets,
      nipIssuedToday,
      totalUsers,
      totalRequests,
      totalDrivers,
      weeklyRequests,
      monthlyRequests
    ] = await Promise.all([
      // Today's requests
      prisma.request.count({ 
        where: { 
          createdAt: { gte: startOfDay } 
        } 
      }).catch(() => 0),
      
      // Active drivers
      prisma.driverProfile.count({ 
        where: { 
          status: 'ONLINE' 
        } 
      }).catch(() => 0),
      
      // Open support tickets
      prisma.supportTicket.count({ 
        where: { 
          status: 'OPEN' 
        } 
      }).catch(() => 0),
      
      // TIREM issued today
      prisma.nIPLedger.aggregate({
        where: { 
          createdAt: { gte: startOfDay }, 
          amount: { gt: 0 } 
        },
        _sum: { amount: true }
      }).then(result => result._sum?.amount ?? 0).catch(() => 0),
      
      // Total users
      prisma.user.count().catch(() => 0),
      
      // Total requests
      prisma.request.count().catch(() => 0),
      
      // Total drivers
      prisma.driverProfile.count().catch(() => 0),
      
      // Weekly requests
      prisma.request.count({
        where: {
          createdAt: { gte: startOfWeek }
        }
      }).catch(() => 0),
      
      // Monthly requests
      prisma.request.count({
        where: {
          createdAt: { gte: startOfMonth }
        }
      }).catch(() => 0)
    ]);

    // Calculate percentages and trends
    const avgDailyRequests = Math.round(totalRequests / 30); // Rough estimate
    const driverUtilization = totalDrivers > 0 ? Math.round((activeDrivers / totalDrivers) * 100) : 0;
    const weeklyGrowth = weeklyRequests - (monthlyRequests - weeklyRequests);

    return {
      requestsToday,
      activeDrivers,
      openTickets,
      nipIssuedToday,
      totalUsers,
      totalRequests,
      totalDrivers,
      weeklyRequests,
      monthlyRequests,
      avgDailyRequests,
      driverUtilization,
      weeklyGrowth
    };
  } catch (error) {
    console.error('[AdminOverview] Failed to fetch statistics:', error);
    throw error;
  }
}

function AdminStatsContent({ stats }: { stats: any }) {
  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <div className="grid md:grid-cols-4 gap-4">
        <OtwCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-otwGold/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="text-sm font-medium text-muted-foreground">Requests Today</div>
            <div className="mt-2">
              <OtwStatPill 
                label="Count" 
                value={String(stats.requestsToday)} 
                tone={stats.requestsToday > stats.avgDailyRequests ? "success" : "neutral"}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Avg: {stats.avgDailyRequests}/day
            </div>
          </div>
        </OtwCard>
        
        <OtwCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="text-sm font-medium text-muted-foreground">Active Drivers</div>
            <div className="mt-2">
              <OtwStatPill 
                label="Online" 
                value={String(stats.activeDrivers)} 
                tone="success" 
              />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {stats.driverUtilization}% of {stats.totalDrivers} total
            </div>
          </div>
        </OtwCard>
        
        <OtwCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="text-sm font-medium text-muted-foreground">Open Tickets</div>
            <div className="mt-2">
              <OtwStatPill 
                label="Support" 
                value={String(stats.openTickets)} 
                tone={stats.openTickets > 5 ? "danger" : "neutral"}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {stats.openTickets > 0 ? `${stats.openTickets} need attention` : 'All clear'}
            </div>
          </div>
        </OtwCard>
        
        <OtwCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-otwGold/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
            <div className="text-sm font-medium text-muted-foreground">TIREM Issued Today</div>
            <div className="mt-2">
              <OtwStatPill 
                label="TIREM" 
                value={String(stats.nipIssuedToday)} 
                tone="gold" 
              />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Points distributed
            </div>
          </div>
        </OtwCard>
      </div>

      {/* Secondary Metrics */}
      <div className="grid md:grid-cols-3 gap-4">
        <OtwCard>
          <div className="text-sm font-medium text-white/80">Weekly Performance</div>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">This Week</span>
              <span className="font-medium">{stats.weeklyRequests} requests</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Growth</span>
              <span className={`font-medium ${
                stats.weeklyGrowth >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {stats.weeklyGrowth >= 0 ? '+' : ''}{stats.weeklyGrowth}
              </span>
            </div>
          </div>
        </OtwCard>

        <OtwCard>
          <div className="text-sm font-medium text-white/80">System Health</div>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Total Users</span>
              <span className="font-medium">{stats.totalUsers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Total Drivers</span>
              <span className="font-medium">{stats.totalDrivers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Total Requests</span>
              <span className="font-medium">{stats.totalRequests}</span>
            </div>
          </div>
        </OtwCard>

        <OtwCard>
          <div className="text-sm font-medium text-white/80">Quick Actions</div>
          <div className="mt-3 space-y-2">
            <div className="text-xs text-white/60">
              Common admin tasks and shortcuts
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="text-xs px-2 py-1 rounded bg-white/10 text-center">
                View Reports
              </div>
              <div className="text-xs px-2 py-1 rounded bg-white/10 text-center">
                Manage Users
              </div>
              <div className="text-xs px-2 py-1 rounded bg-white/10 text-center">
                System Logs
              </div>
              <div className="text-xs px-2 py-1 rounded bg-white/10 text-center">
                Settings
              </div>
            </div>
          </div>
        </OtwCard>
      </div>
    </div>
  );
}

function AdminStatsErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load dashboard statistics</div>
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

async function AdminStats() {
  let stats: any = null;
  let error: unknown = null;

  try {
    stats = await getAdminStats();
  } catch (err) {
    error = err;
  }

  if (error) {
    return <AdminStatsErrorState error={error} />;
  }

  return <AdminStatsContent stats={stats} />;
}

export default async function AdminOverviewPage() {
  await requireRole(['ADMIN']);
  
  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="OTW HQ — Admin Dashboard" 
        subtitle="System overview and key performance indicators." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminOverviewLoading />}>
          <AdminStats />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}
