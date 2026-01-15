import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { acceptJobAction, getAvailableJobs } from '@/app/actions/driver';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DriverJobsPage() {
  noStore();
  const prisma = getPrisma();
  const user = await getCurrentUser();
  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Driver Jobs" subtitle="Available, active, completed." />
        <OtwCard className="mt-3"><div className="text-sm">Please sign in.</div></OtwCard>
      </OtwPageShell>
    );
  }
  const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id }, include: { zone: true } });
  if (!driver) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Driver Jobs" subtitle="Available, active, completed." />
        <OtwEmptyState title="No driver profile" subtitle="Contact support or admin." />
      </OtwPageShell>
    );
  }
  
  const available = await getAvailableJobs();
  
  const active = await prisma.request.findMany({
    where: { assignedDriverId: driver.id, status: { in: ['ASSIGNED', 'PICKED_UP'] } },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  const completed = await prisma.request.findMany({
    where: { assignedDriverId: driver.id, status: { in: ['COMPLETED', 'DELIVERED'] } },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Driver Jobs" subtitle={`Zone: ${driver.zone?.name ?? 'Unassigned'}`} />
      <div className="mt-3 grid md:grid-cols-2 gap-4">
        <OtwCard>
          <div className="text-sm font-medium">Available</div>
          {available.length === 0 ? (
            <OtwEmptyState title="No jobs" subtitle="No available requests in your zone." />
          ) : (
            <ul className="mt-2 space-y-2 text-sm opacity-90">
              {available.map((r) => (
                <li key={r.id} className="py-2 border-b border-white/10 last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{r.pickup}</div>
                      <div className="text-xs opacity-70">to {r.dropoff}</div>
                    </div>
                    <form action={acceptJobAction} className="flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <OtwButton variant="outline" size="sm">Accept</OtwButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OtwCard>
        <OtwCard>
          <div className="text-sm font-medium">Active</div>
          {active.length === 0 ? (
            <div className="mt-2 text-sm opacity-80">No active jobs.</div>
          ) : (
            <ul className="mt-2 space-y-2 text-sm opacity-90">
              {active.map((r) => (
                <li key={r.id} className="py-2 border-b border-white/10 last:border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{r.status}</div>
                        <div className="text-xs opacity-70">{r.pickup} → {r.dropoff}</div>
                      </div>
                    <div className="flex gap-2">
                      <OtwButton as="a" href={`/driver/jobs/${r.id}`} variant="outline" size="sm">
                        Open
                      </OtwButton>
                      <OtwButton as="a" href={`/driver?jobId=${r.id}`} variant="outline" size="sm">
                        Driver Map
                      </OtwButton>
                    </div>
                  </div>
                </li>
                ))}
              </ul>
          )}
        </OtwCard>
        <OtwCard className="md:col-span-2">
          <div className="text-sm font-medium">Completed</div>
          {completed.length === 0 ? (
            <div className="mt-2 text-sm opacity-80">No completed jobs yet.</div>
          ) : (
            <ul className="mt-2 space-y-2 text-sm opacity-90">
              {completed.map((r) => (
                <li key={r.id} className="py-2 border-b border-white/10 last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{r.pickup} → {r.dropoff}</div>
                    </div>
                    <div>${(Number(r.costEstimate || 0)/100).toFixed(2)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
