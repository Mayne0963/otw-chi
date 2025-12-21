import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

export default async function DriverJobsPage() {
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
  const available = await prisma.request.findMany({
    where: { status: 'SUBMITTED', zoneId: driver.zoneId ?? undefined },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  const active = await prisma.request.findMany({
    where: { assignedDriverId: driver.id, status: { in: ['ASSIGNED', 'PICKED_UP', 'DELIVERED'] } },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  const completed = await prisma.request.findMany({
    where: { assignedDriverId: driver.id, status: 'COMPLETED' },
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
              {available.map(r => (
                <li key={r.id}>
                  <div className="flex items-center justify-between">
                    <div>{r.pickup} → {r.dropoff}</div>
                    <form action={acceptJob} className="flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <OtwButton variant="outline">Accept</OtwButton>
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
              {active.map(r => (
                <li key={r.id}>
                  <div className="flex items-center justify-between">
                    <div>{r.status} • {r.pickup} → {r.dropoff}</div>
                    <OtwButton as="a" href={`/driver/jobs/${r.id}`} variant="outline">Open</OtwButton>
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
              {completed.map(r => (
                <li key={r.id}>
                  <div className="flex items-center justify-between">
                    <div>{r.pickup} → {r.dropoff}</div>
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

export async function acceptJob(formData: FormData) {
  'use server';
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return;
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({ where: { clerkId: userId } });
  if (!user) return;
  const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
  if (!driver) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await prisma.request.update({
    where: { id },
    data: { assignedDriverId: driver.id, status: 'ASSIGNED' },
  });
  await prisma.requestEvent.create({ data: { requestId: id, type: 'ASSIGNED', message: `Assigned to driver ${driver.id}` } });
}
