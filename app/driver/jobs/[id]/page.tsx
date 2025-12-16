import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import type { RequestEvent as RequestEventModel } from '@prisma/client';
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
  const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
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
        </OtwCard>
        <OtwCard className="md:col-span-2">
          <div className="text-sm font-medium">Events</div>
          <ul className="mt-2 text-sm opacity-80 list-disc pl-5">
            {req.events
              .sort((a: RequestEventModel, b: RequestEventModel) => a.timestamp.getTime() - b.timestamp.getTime())
              .map((ev: RequestEventModel) => (
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
    // Base NIP reward: 5 per mile, multiplied by membership plan multiplier
    const sub = await prisma.membershipSubscription.findUnique({ where: { userId: customerId }, include: { plan: true } });
    const multiplier = Number(sub?.plan?.nipMultiplier || 1.0);
    const nipReward = Math.max(0, Math.round(miles * 5 * multiplier));
    if (nipReward > 0) {
      await prisma.nIPLedger.create({
        data: {
          userId: customerId,
          requestId: id,
          amount: nipReward,
          reason: 'COMPLETION_REWARD',
        },
      });
    }
  }
}
