import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import OtwButton from '@/components/ui/otw/OtwButton';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  const user = await getCurrentUser();
  let active: Array<{ id: string; status: string; serviceType: string; pickup: string; dropoff: string; costEstimate: number; createdAt: string }> = [];
  let completed: Array<{ id: string; status: string; serviceType: string; pickup: string; dropoff: string; costEstimate: number; createdAt: string }> = [];
  if (user) {
    const prisma = getPrisma();
    const list = await prisma.request.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    active = list.filter(r => ['SUBMITTED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'].includes(r.status)).map(r => ({
      id: r.id, status: r.status, serviceType: String(r.serviceType), pickup: r.pickup, dropoff: r.dropoff, costEstimate: Math.round(Number(r.costEstimate || 0)), createdAt: r.createdAt.toISOString(),
    }));
    completed = list.filter(r => r.status === 'COMPLETED' || r.status === 'CANCELLED').map(r => ({
      id: r.id, status: r.status, serviceType: String(r.serviceType), pickup: r.pickup, dropoff: r.dropoff, costEstimate: Math.round(Number(r.costEstimate || 0)), createdAt: r.createdAt.toISOString(),
    }));
  }
  return (
    <OtwPageShell>
      <OtwSectionHeader title="My Requests" subtitle="History and status." />
      {!user ? (
        <OtwEmptyState title="Sign in to view requests" actionHref="/sign-in" actionLabel="Sign In" />
      ) : (
        <>
          <OtwCard>
            <div className="text-sm font-medium">Active</div>
            {active.length === 0 ? (
              <OtwEmptyState title="No active" subtitle="Start a new request." actionHref="/requests/new" actionLabel="New Request" />
            ) : (
              <ul className="mt-2 space-y-2">
                {active.map(r => (
                  <li key={r.id} className="text-sm opacity-90">
                    <div className="flex items-center justify-between">
                      <div>{r.status} • {r.serviceType}</div>
                      <OtwButton as="a" href={`/requests/${r.id}`} variant="outline">View</OtwButton>
                    </div>
                    <div className="opacity-80">{r.pickup} → {r.dropoff}</div>
                    <div className="opacity-80">Est. ${r.costEstimate / 100}</div>
                  </li>
                ))}
              </ul>
            )}
          </OtwCard>
          <OtwCard className="mt-3">
            <div className="text-sm font-medium">Completed</div>
            {completed.length === 0 ? (
              <div className="mt-2 text-sm opacity-80">No completed requests.</div>
            ) : (
              <ul className="mt-2 space-y-2">
                {completed.map(r => (
                  <li key={r.id} className="text-sm opacity-90">
                    <div className="flex items-center justify-between">
                      <div>{r.status} • {r.serviceType}</div>
                      <OtwButton as="a" href={`/requests/${r.id}`} variant="outline">View</OtwButton>
                    </div>
                    <div className="opacity-80">{r.pickup} → {r.dropoff}</div>
                    <div className="opacity-80">Est. ${r.costEstimate / 100}</div>
                  </li>
                ))}
              </ul>
            )}
          </OtwCard>
        </>
      )}
    </OtwPageShell>
  );
}
