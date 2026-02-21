import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';

function formatCurrency(value: number | null | undefined): string {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

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
      prisma.deliveryRequest.count({ 
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
      prisma.deliveryRequest.count().catch(() => 0),
      
      // Total drivers
      prisma.driverProfile.count().catch(() => 0),
      
      // Weekly requests
      prisma.deliveryRequest.count({
        where: {
          createdAt: { gte: startOfWeek }
        }
      }).catch(() => 0),
      
      // Monthly requests
      prisma.deliveryRequest.count({
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

function AdminStatsBody({ stats, summary }: { stats: any, summary: any }) {
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
          <div className="text-sm font-medium text-white/80">Reports</div>
          <div className="mt-3 space-y-2">
            <div className="text-xs text-white/60">
              Export data for analysis and record-keeping.
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <OtwButton as="a" href="/api/admin/receipts/export" variant="ghost" className="text-xs px-2 py-1 h-auto text-center justify-center bg-white/10 hover:bg-white/20" data-testid="admin-export-button">
                Export Receipts
              </OtwButton>
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
              <OtwButton as="a" href="/admin/customers" variant="ghost" className="text-xs px-2 py-1 h-auto text-center justify-center bg-white/10 hover:bg-white/20">
                Customers
              </OtwButton>
              <OtwButton as="a" href="/admin/drivers" variant="ghost" className="text-xs px-2 py-1 h-auto text-center justify-center bg-white/10 hover:bg-white/20">
                Drivers
              </OtwButton>
              <OtwButton as="a" href="/admin/cities-zones" variant="ghost" className="text-xs px-2 py-1 h-auto text-center justify-center bg-white/10 hover:bg-white/20">
                Zones
              </OtwButton>
              <OtwButton as="a" href="/admin/settings" variant="ghost" className="text-xs px-2 py-1 h-auto text-center justify-center bg-white/10 hover:bg-white/20">
                Settings
              </OtwButton>
            </div>
          </div>
        </OtwCard>
      </div>

      {summary && (
        <div className="mt-6" data-testid="admin-summary-widget">
          <OtwSectionHeader title="Receipts Summary" subtitle="Overview of receipt verification stats." />
          <div className="mt-3 grid md:grid-cols-4 gap-4">
            <OtwCard>
              <div className="text-sm font-medium text-muted-foreground">Total Receipts</div>
              <div className="mt-2">
                <OtwStatPill label="Count" value={String(summary.totalReceipts)} />
              </div>
            </OtwCard>
            <OtwCard>
              <div className="text-sm font-medium text-muted-foreground">Approved</div>
              <div className="mt-2">
                <OtwStatPill label="Count" value={String(summary.approvedCount)} tone="success" />
              </div>
            </OtwCard>
            <OtwCard>
              <div className="text-sm font-medium text-muted-foreground">Flagged</div>
              <div className="mt-2">
                <OtwStatPill label="Count" value={String(summary.flaggedCount)} tone="info" />
              </div>
            </OtwCard>
            <OtwCard>
              <div className="text-sm font-medium text-muted-foreground">Rejected</div>
              <div className="mt-2">
                <OtwStatPill label="Count" value={String(summary.rejectedCount)} tone="danger" />
              </div>
            </OtwCard>
            <OtwCard>
              <div className="text-sm font-medium text-muted-foreground">Avg. Proof Score</div>
              <div className="mt-2">
                <OtwStatPill label="Score" value={String(summary.avgProofScore.toFixed(2))} />
              </div>
            </OtwCard>
            <OtwCard>
              <div className="text-sm font-medium text-muted-foreground">Locked</div>
              <div className="mt-2">
                <OtwStatPill label="Count" value={String(summary.lockedCount)} />
              </div>
            </OtwCard>
            <OtwCard>
              <div className="text-sm font-medium text-muted-foreground">Approved Revenue</div>
              <div className="mt-2">
                <OtwStatPill label="Total" value={formatCurrency(summary.totalApprovedRevenue)} />
              </div>
            </OtwCard>
          </div>
        </div>
      )}
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
      <OtwButton 
        as="a"
        href="/admin"
        className="mt-4 text-xs px-3 py-2"
        variant="ghost"
      >
        Retry
      </OtwButton>
    </OtwCard>
  );
}

async function AdminStats() {
  let stats: any = null;
  let error: unknown = null;
  let summary: any = null;

  try {
    stats = await getAdminStats();
    const summaryRes = await fetch('/api/admin/receipts/summary');
    summary = await summaryRes.json();
  } catch (err) {
    error = err;
  }

  if (error) {
    return <AdminStatsErrorState error={error} />;
  }

  return <AdminStatsBody stats={stats} summary={summary} />;
}

export default async function AdminPage() {
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
