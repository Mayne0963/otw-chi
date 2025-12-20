import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { RequestEvent } from '.prisma/client';
import { canTransition } from '@/lib/lifecycle';

export const dynamic = 'force-dynamic';

export default async function DriverJobDetailPage({ params }: { params: { id: string } }) {
  const prisma = getPrisma();
  const user = await getCurrentUser();
  if (!user) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title={`Job ${params.id}`} subtitle="Update status and view details." />
        <OtwCard className="mt-3"><div className="text-sm">Please sign in.</div></OtwCard>
      </OtwPageShell>
    );
  }

  // Authorization: Must be a DRIVER or ADMIN
  // Note: We should ideally check user.role, but fetching driver profile confirms driver status.
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

  const req = await prisma.request.findUnique({ where: { id: params.id }, include: { customer: true, events: true } });
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
          <div className="mt-3 flex gap-2">
            {canAccept && (
              <form action={acceptJobAction}>
                <input type="hidden" name="id" value={req.id} />
                <OtwButton variant="outline">Accept</OtwButton>
              </form>
            )}
            {isAssignedToMe && (
              <>
                <form action={updateJobStatusAction}>
                  <input type="hidden" name="id" value={req.id} />
                  <input type="hidden" name="status" value="PICKED_UP" />
                  <OtwButton variant="outline">Picked Up</OtwButton>
                </form>
                <form action={updateJobStatusAction}>
                  <input type="hidden" name="id" value={req.id} />
                  <input type="hidden" name="status" value="DELIVERED" />
                  <OtwButton variant="gold">Delivered</OtwButton>
                </form>
                <form action={updateJobStatusAction}>
                  <input type="hidden" name="id" value={req.id} />
                  <input type="hidden" name="status" value="COMPLETED" />
                  <OtwButton>Complete</OtwButton>
                </form>
              </>
            )}
          </div>
          {isAssignedToMe && (req.status === 'DELIVERED' || req.status === 'COMPLETED') && (
            <div className="mt-4">
              <div className="text-sm font-medium">Rate this job</div>
              <form action={submitRatingAction} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="id" value={req.id} />
                <select name="rating" className="rounded-lg bg-otwBlack/40 border border-white/15 px-2 py-1">
                  <option value="5">5 — Excellent</option>
                  <option value="4">4 — Good</option>
                  <option value="3">3 — Fair</option>
                  <option value="2">2 — Poor</option>
                  <option value="1">1 — Bad</option>
                </select>
                <OtwButton variant="outline">Submit Rating</OtwButton>
              </form>
            </div>
          )}
        </OtwCard>
        <OtwCard className="md:col-span-2">
          <div className="text-sm font-medium">Events</div>
          <ul className="mt-2 text-sm opacity-80 list-disc pl-5">
            {req.events
              .sort((a: RequestEvent, b: RequestEvent) => a.timestamp.getTime() - b.timestamp.getTime())
              .map((ev: RequestEvent) => (
              <li key={ev.id}>{ev.type}{ev.message ? ` — ${ev.message}` : ''}</li>
            ))}
          </ul>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}

export async function acceptJobAction(formData: FormData) {
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

export async function updateJobStatusAction(formData: FormData) {
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
  const status = String(formData.get('status') ?? '').toUpperCase();
  if (!id || !status) return;
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req || req.assignedDriverId !== driver.id) return;
  if (!canTransition(req.status as any, status as any)) return;
  const updated = await prisma.request.update({ where: { id }, data: { status: status as any } });
  await prisma.requestEvent.create({ data: { requestId: id, type: `STATUS_${status}`, message: `Status changed to ${status}` } });
  if (status === 'COMPLETED') {
    const customerId = updated.customerId;
    const miles = Number(updated.milesEstimate || 0);
    const sub = await prisma.membershipSubscription.findUnique({ where: { userId: customerId }, include: { plan: true } });
    const mRaw = (sub?.plan as any)?.nipMultiplier;
    const multiplier = typeof mRaw === 'number' ? mRaw : 1.0;
    const nipReward = Math.max(0, Math.round(miles * 5 * multiplier));
    if (nipReward > 0) {
      await prisma.nIPLedger.create({
        data: {
          userId: customerId,
          requestId: id,
          amount: nipReward,
          type: 'COMPLETION_REWARD',
        },
      });
    }
  }
}

export async function submitRatingAction(formData: FormData) {
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
  const ratingVal = Number(formData.get('rating') ?? 0);
  if (!id || !(ratingVal >= 1 && ratingVal <= 5)) return;
  const req = await prisma.request.findUnique({ where: { id } });
  if (!req || req.assignedDriverId !== driver.id) return;
  await prisma.requestEvent.create({ data: { requestId: id, type: 'RATING', message: String(ratingVal) } });
  const ratings = await prisma.requestEvent.findMany({
    where: { type: 'RATING', request: { assignedDriverId: driver.id } },
    select: { message: true },
  });
  const nums = ratings.map(r => Number(r.message)).filter(n => !Number.isNaN(n) && n >= 1 && n <= 5);
  const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : ratingVal;
  await prisma.driverProfile.update({ where: { id: driver.id }, data: { rating: avg } });
}
