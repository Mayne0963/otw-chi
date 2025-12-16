import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import { getPrisma } from '@/lib/db';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const prisma = getPrisma();
  const req = await prisma.request.findUnique({
    where: { id: params.id },
    include: { assignedDriver: { include: { user: true } }, events: true },
  });
  if (!req) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Request Not Found" subtitle="Check the URL and try again." />
        <OtwEmptyState title="No request" subtitle="Return to your list." actionHref="/requests" actionLabel="Back to Requests" />
      </OtwPageShell>
    );
  }
  const driverName = req.assignedDriver?.user?.name || null;
  const driverRating = req.assignedDriver?.rating || null;
  return (
    <OtwPageShell>
      <OtwSectionHeader title={`Request ${req.id}`} subtitle="Status timeline and events." />
      <div className="mt-3 grid md:grid-cols-3 gap-4">
        <OtwCard>
          <div className="text-sm font-medium">Status</div>
          <div className="mt-2"><OtwStatPill label="State" value={req.status} /></div>
          <div className="mt-3 text-sm opacity-80">Service: {String(req.serviceType)}</div>
          <div className="mt-1 text-sm opacity-80">{req.pickup} → {req.dropoff}</div>
          {driverName && (
            <div className="mt-3 text-sm opacity-80">Driver: {driverName}{driverRating ? ` • ${driverRating.toFixed(1)}` : ''}</div>
          )}
        </OtwCard>
        <OtwCard className="md:col-span-2">
          <div className="text-sm font-medium">Events</div>
          <ul className="mt-2 text-sm opacity-80 list-disc pl-5">
            {req.events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()).map(ev => (
              <li key={ev.id}>{ev.type}{ev.message ? ` — ${ev.message}` : ''}</li>
            ))}
          </ul>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
