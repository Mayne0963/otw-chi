import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { updateJobStatusAction } from '@/app/actions/driver';
import { DRIVER_ACTIVE_REQUEST_STATUSES } from '@/lib/driver-assignment';
import { isDispatchBlockedByPayment } from '@/lib/request-payment';
import { unstable_noStore as noStore } from 'next/cache';
import { serverFeatureFlags } from '@/lib/featureFlags';
import { purgeExpiredPickupPassForRequest } from '@/lib/pickup-pass';
import PickupVerificationPanel from '@/components/requests/PickupVerificationPanel';
import RequestChat from '@/components/messages/RequestChat';
import DriverAcceptJobButton from '@/components/driver/DriverAcceptJobButton';

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

  const req = await prisma.deliveryRequest.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      assignedDriverId: true,
      status: true,
      pickupAddress: true,
      dropoffAddress: true,
      notes: true,
      serviceType: true,
      paymentRequired: true,
      deliveryFeePaid: true,
      deliveryFeeCents: true,
      overageBillingMode: true,
      overageMiles: true,
      overageStatus: true,
      scheduledFor: true,
      dispatchAt: true,
      orderReference: true,
      pickupInstructions: true,
      dropoffInstructions: true,
      pickupCodeType: true,
      pickupCodeText: true,
      pickupPassImageUrl: true,
      pickupPassMimeType: true,
      pickupPassUploadedAt: true,
      pickupPassExpiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
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
  const canViewPickupArtifacts = isAdmin || isAssignedToMe;
  const isDispatchable = req.deliveryFeePaid === true || req.paymentRequired === false;
  const now = new Date();
  const isWithinDispatchWindow = !req.dispatchAt || req.dispatchAt.getTime() <= now.getTime();
  const hasOtherActiveJob = !!driver && !!(await prisma.deliveryRequest.findFirst({
    where: {
      assignedDriverId: driver.id,
      status: { in: DRIVER_ACTIVE_REQUEST_STATUSES },
      id: { not: req.id },
    },
    select: { id: true },
  }));

  if (!isDispatchable && !isAdmin) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Job Unavailable" subtitle="Payment pending for this request." />
        <OtwEmptyState
          title="Not dispatchable yet"
          subtitle="This request will appear after payment is confirmed."
          actionHref="/driver/jobs"
          actionLabel="Back to Jobs"
        />
      </OtwPageShell>
    );
  }
  if (!isWithinDispatchWindow && !isAdmin) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Job Unavailable" subtitle="Scheduled dispatch window has not opened yet." />
        <OtwEmptyState
          title="Dispatch pending"
          subtitle={
            req.scheduledFor
              ? `Available around ${new Date(req.scheduledFor).toLocaleString()}.`
              : 'This request will appear when dispatch opens.'
          }
          actionHref="/driver/jobs"
          actionLabel="Back to Jobs"
        />
      </OtwPageShell>
    );
  }
  
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

  const purgedCount = await purgeExpiredPickupPassForRequest(prisma, req.id);
  if (purgedCount > 0) {
    req.pickupPassMimeType = null;
    req.pickupPassUploadedAt = null;
    req.pickupPassExpiresAt = null;
  }

  const canAccept =
    !!driver &&
    req.status === 'REQUESTED' &&
    !req.assignedDriverId &&
    isWithinDispatchWindow &&
    !isDispatchBlockedByPayment(req) &&
    !(req.overageBillingMode === 'INSTANT' && req.overageMiles > 0 && req.overageStatus !== 'PAID') &&
    req.userId !== user.id &&
    !hasOtherActiveJob;
  
  return (
    <OtwPageShell>
      <OtwSectionHeader title={`Job ${req.id}`} subtitle="Update status and view details." />
      <div className="mt-3 grid md:grid-cols-3 gap-4">
        <OtwCard>
          <div className="text-sm font-medium">Details</div>
          <div className="mt-2 text-sm opacity-90">Status: {req.status}</div>
          <div className="mt-1 text-sm opacity-90">Pickup: {req.pickupAddress}</div>
          <div className="mt-1 text-sm opacity-90">Dropoff: {req.dropoffAddress}</div>
          <div className="mt-1 text-sm opacity-80">Customer: {req.user?.name ?? req.user?.email}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {canAccept && (
              <DriverAcceptJobButton requestId={req.id} label="Accept" variant="outline" />
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
                  <form action={updateJobStatusAction} data-testid="driver-complete-delivery-form">
                    <input type="hidden" name="id" value={req.id} />
                    <input type="hidden" name="status" value="DELIVERED" />
                    <OtwButton type="submit" variant="gold" data-testid="driver-complete-delivery-button">Delivered</OtwButton>
                  </form>
                )}
              </>
            )}
          </div>

          {canViewPickupArtifacts ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <PickupVerificationPanel
                requestId={req.id}
                canEdit={false}
                pickupPassFeatureEnabled={serverFeatureFlags.pickupPass}
                initialOrderReference={req.orderReference}
                initialPickupInstructions={req.pickupInstructions}
                initialDropoffInstructions={req.dropoffInstructions}
                initialPickupCodeType={req.pickupCodeType}
                initialPickupCodeText={req.pickupCodeText}
                initialPickupPassUploadedAt={req.pickupPassUploadedAt?.toISOString() ?? null}
                initialPickupPassExpiresAt={req.pickupPassExpiresAt?.toISOString() ?? null}
                initialPickupPassExpired={
                  req.pickupPassExpiresAt ? req.pickupPassExpiresAt <= new Date() : false
                }
                initialHasPickupPass={Boolean(req.pickupPassImageUrl || req.pickupPassMimeType)}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/65">
              Pickup verification details unlock after this request is assigned to you.
            </div>
          )}

          {serverFeatureFlags.chat && (
            req.assignedDriverId && canViewPickupArtifacts ? (
              <div className="mt-4">
                <RequestChat
                  requestId={req.id}
                  currentUserId={user.id}
                  currentUserRole={user.role}
                  readOnly={isAdmin}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/65">
                Chat opens once a driver is assigned.
              </div>
            )
          )}
        </OtwCard>
        
        <OtwCard className="md:col-span-2">
          <div className="text-sm font-medium">Events</div>
           <ul className="mt-2 text-sm opacity-80 list-disc pl-5">
            {/* Events view is not supported for delivery requests yet */}
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
