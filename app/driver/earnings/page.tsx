import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

export default async function DriverEarningsPage() {
  const prisma = getPrisma();
  const user = await getCurrentUser();
  let weekly = 0;
  let monthly = 0;
  let recent: Array<{ id: string; pickup: string; dropoff: string; costEstimate: number; completedAt: string }> = [];
  if (user) {
    const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
    if (driver) {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0,0,0,0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const completed = await prisma.request.findMany({
        where: { assignedDriverId: driver.id, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      const earningPct = 0.7;
      recent = completed.map(r => ({
        id: r.id,
        pickup: r.pickup,
        dropoff: r.dropoff,
        costEstimate: Math.round(Number(r.costEstimate || 0)),
        completedAt: r.createdAt.toISOString(),
      }));
      weekly = completed
        .filter(r => r.createdAt >= startOfWeek)
        .reduce((sum, r) => sum + Math.round(Number(r.costEstimate || 0) * earningPct), 0);
      monthly = completed
        .filter(r => r.createdAt >= startOfMonth)
        .reduce((sum, r) => sum + Math.round(Number(r.costEstimate || 0) * earningPct), 0);
    }
  }
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Driver Earnings" subtitle="Ledger summary and payouts." />
      <div className="mt-3 grid md:grid-cols-3 gap-4">
        <OtwCard>
          <div className="text-sm font-medium">Weekly</div>
          <div className="mt-2"><OtwStatPill label="USD" value={`$${(weekly/100).toFixed(2)}`} tone="success" /></div>
        </OtwCard>
        <OtwCard>
          <div className="text-sm font-medium">Monthly</div>
          <div className="mt-2"><OtwStatPill label="USD" value={`$${(monthly/100).toFixed(2)}`} tone="gold" /></div>
        </OtwCard>
        <OtwCard>
          <div className="text-sm font-medium">Actions</div>
          <div className="mt-2"><OtwButton variant="outline">Request Payout</OtwButton></div>
        </OtwCard>
      </div>
      <OtwCard className="mt-3">
        <div className="text-sm font-medium">Recent Completed Jobs</div>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm opacity-80">No completed jobs yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm opacity-90">
            {recent.map(r => (
              <li key={r.id}>
                <div className="flex items-center justify-between">
                  <div>{r.pickup} → {r.dropoff}</div>
                  <div>${(r.costEstimate/100).toFixed(2)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}
