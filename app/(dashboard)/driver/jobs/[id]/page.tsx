import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { acceptJobAction, updateJobStatusAction } from '@/app/actions/driver';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DriverJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await params;
  const prisma = getPrisma();
  const user = await getCurrentUser();
  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title={`Job ${id}`} subtitle="Update status and view details." />
        <OtwCard className="mt-3"><div className="text-sm">Please sign in.</div></OtwCard>
      </OtwPageShell>
    );
  }

  // Authorization: Must be a DRIVER or ADMIN
  const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
  const isAdmin = user.role === 'ADMIN';

  if (!driver && !isAdmin) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Access Denied" subtitle="Driver account required." />
        <OtwCard className="mt-3"><div className="text-sm text-red-400">You must be a registered driver to view jobs.</div></OtwCard>
      </OtwPageShell>
    );
  }

  const req = await prisma.request.findUnique({ where: { id }, include: { customer: true, events: true } });
  if (!req) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Job Not Found" subtitle="Check the URL and try again." />
        <OtwEmptyState title="No job" subtitle="Return to jobs list." actionHref="/driver/jobs" actionLabel="Back to Jobs" />
      </OtwPageShell>
    );
  }

  const isAssignedToMe = !!driver && req.assignedDriverId === driver.id;
  const isUnassigned = req.assignedDriverId === null;
  
  // Visibility Rule: 
  // 1. If assigned to me: Visible.
  // 2. If unassigned (Open market): Visible.
  // 3. If assigned to someone else: Hidden (unless Admin).
  if (!isAssignedToMe && !isUnassigned && !isAdmin) {
     return (
      <OtwPageShell>
        <OtwSectionHeader title="Job Taken" subtitle="This job has been assigned to another driver." />
        <OtwEmptyState title="Job Unavailable" subtitle="Return to available jobs." actionHref="/driver/jobs" actionLabel="Back to Jobs" />
      </OtwPageShell>
    );
  }

  const canAccept = !!driver && req.status === 'SUBMITTED' && !req.assignedDriverId;
  
  return (
    <OtwPageShell>
      <OtwSectionHeader title={`Job ${req.id}`} subtitle="Update status and view details." />
      <div className="mt-3 grid md:grid-cols-3 gap-4">
        <OtwCard>
          <div className="text-sm font-medium">Details</div>
          <div className="mt-2 text-sm opacity-90">Status: {req.status}</div>
          <div className="mt-1 text-sm opacity-90">Pickup: {req.pickup}</div>
          <div className="mt-1 text-sm opacity-90">Dropoff: {req.dropoff}</div>
          <div className="mt-1 text-sm opacity-80">Customer: {req.customer?.name ?? req.customer?.email}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {canAccept && (
              <form action={acceptJobAction}>
                <input type="hidden" name="id" value={req.id} />
                <OtwButton type="submit" variant="outline">Accept</OtwButton>
              </form>
            )}
            {isAssignedToMe && (
              <>
                {req.status === 'ASSIGNED' && (
                  <form action={updateJobStatusAction}>
                    <input type="hidden" name="id" value={req.id} />
                    <input type="hidden" name="status" value="PICKED_UP" />
                    <OtwButton type="submit" variant="outline">Picked Up</OtwButton>
                  </form>
                )}
                {req.status === 'PICKED_UP' && (
                  <form action={updateJobStatusAction}>
                    <input type="hidden" name="id" value={req.id} />
                    <input type="hidden" name="status" value="COMPLETED" />
                    <OtwButton type="submit" variant="gold">Delivered</OtwButton>
                  </form>
                )}
              </>
            )}
          </div>
        </OtwCard>
        
        <OtwCard className="md:col-span-2">
          <div className="text-sm font-medium">Events</div>
           <ul className="mt-2 text-sm opacity-80 list-disc pl-5">
            {req.events
              .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
              .map((ev) => (
              <li key={ev.id}>{ev.type}{ev.message ? ` — ${ev.message}` : ''}</li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <OtwButton as="a" href={`/driver?jobId=${req.id}`} variant="outline">
              Open in Driver Map
            </OtwButton>
          </div>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
