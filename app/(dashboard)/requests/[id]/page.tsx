import { getRequest } from '@/app/actions/request';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { formatDate, formatCurrency } from '@/lib/utils';
import { MapPin, User, ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import TrackMapWrapper from '@/components/otw/TrackMapWrapper';
import type { OtwDriverLocation } from '@/lib/otw/otwDriverLocation';
import { serverFeatureFlags } from '@/lib/featureFlags';
import PickupVerificationPanel from '@/components/requests/PickupVerificationPanel';
import RequestChat from '@/components/messages/RequestChat';
import RequestRatingPanel from '@/components/requests/RequestRatingPanel';
import { isDispatchBlockedByPayment } from '@/lib/request-payment';
import CancelOrderButton from '@/components/order/CancelOrderButton';

export const dynamic = 'force-dynamic';

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  const request = await getRequest(id);

  if (!request) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Request Not Found" subtitle="We couldn't find the request you're looking for." />
        <OtwButton as="a" href="/requests" variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Requests
        </OtwButton>
      </OtwPageShell>
    );
  }

  // Authorization Check: Must be Owner, Assigned Driver, or Admin
  const isOwner = request.userId === user.id;
  const isAssignedDriver = request.assignedDriver?.userId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAssignedDriver && !isAdmin) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Access Denied" subtitle="You are not authorized to view this request." />
        <OtwButton as="a" href="/requests" variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Requests
        </OtwButton>
      </OtwPageShell>
    );
  }

  const driverName = request.assignedDriver?.user?.name;
  const driverRating = request.assignedDriver?.rating;
  const hasDriverSignal =
    request.lastKnownLat != null &&
    request.lastKnownLng != null &&
    request.lastKnownAt != null;
  const driverLabel = driverName?.trim() || 'Driver';
  const driverLocations: OtwDriverLocation[] = hasDriverSignal
    ? [
        {
          driverId: driverLabel,
          location: {
            lat: request.lastKnownLat as number,
            lng: request.lastKnownLng as number,
            label: driverLabel,
          },
          updatedAt: request.lastKnownAt!.toISOString(),
          currentRequestId: request.id,
        },
      ]
    : [];
  const now = new Date();
  const pickupPassExpired = request.pickupPassExpiresAt ? request.pickupPassExpiresAt <= now : false;
  const chatAvailable = serverFeatureFlags.chat && Boolean(request.assignedDriverId);
  const canEditPickupDetails = isOwner || isAdmin;
  const serviceMilesPaid =
    typeof request.serviceMilesPaid === 'number' ? request.serviceMilesPaid : null;
  const paidWithServiceMilesOnly =
    request.paidWithServiceMilesOnly === true &&
    serviceMilesPaid !== null &&
    serviceMilesPaid > 0;
  const needsPayment = isDispatchBlockedByPayment({
    paymentRequired: request.paymentRequired,
    deliveryFeeCents:
      typeof request.deliveryFeeCents === 'number' ? request.deliveryFeeCents : null,
    deliveryFeePaid: request.deliveryFeePaid,
    overageBillingMode: request.overageBillingMode,
  });
  const canCancelAndRefund =
    isOwner &&
    ['REQUESTED', 'ASSIGNED', 'PICKED_UP', 'EN_ROUTE'].includes(request.status);

  return (
    <OtwPageShell>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
            <OtwButton as="a" href="/requests" variant="ghost" size="sm" className="-ml-2">
                <ArrowLeft className="h-4 w-4" />
            </OtwButton>
            <OtwSectionHeader 
                title={`Request ${request.id.slice(-6).toUpperCase()}`} 
                subtitle={`Created on ${formatDate(request.createdAt)}`}
            />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Details */}
        <div className="space-y-6 md:col-span-2">
          {needsPayment ? (
            <OtwCard className="border-otwGold/40 bg-black/30">
              <div className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex rounded bg-otwGold/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-otwGold">
                      Payment Required
                    </div>
                    <p className="mt-2 text-sm text-white/85">Complete payment to dispatch a driver.</p>
                  </div>
                  <Link
                    href={`/pay/${request.id}`}
                    className="inline-flex items-center justify-center rounded-lg bg-otwGold px-4 py-2 text-sm font-semibold text-otwBlack transition-all duration-300 hover:bg-otwGold/90"
                  >
                    Pay Now
                  </Link>
                </div>
              </div>
            </OtwCard>
          ) : (
            <OtwCard className="border-green-500/30 bg-green-500/10">
              <div className="p-3">
                <div className="inline-flex rounded bg-green-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-green-300">
                  Paid
                </div>
                <p className="mt-2 text-sm text-green-200/90">
                  Payment confirmed. Your request is ready for dispatch.
                </p>
              </div>
            </OtwCard>
          )}

          <OtwCard>
            <div className="p-4 border-b border-white/10 mb-4">
                <h3 className="text-lg font-medium text-white">Request Details</h3>
                <p className="text-sm text-white/50">Information about your delivery.</p>
            </div>
            <div className="p-4 grid gap-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white/60">Status</div>
                  <span className={`px-3 py-1 rounded text-sm font-medium uppercase ${
                      request.status === 'DELIVERED' ? 'bg-green-500/20 text-green-400' :
                      request.status === 'CANCELED' ? 'bg-red-500/20 text-red-400' :
                      request.status === 'ASSIGNED' || request.status === 'PICKED_UP' ? 'bg-otwGold/20 text-otwGold' :
                      'bg-white/10 text-white/70'
                  }`}>
                    {request.status}
                  </span>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-sm font-medium text-white/60">Cost</div>
                  <div className="text-xl font-bold text-white">
                    {paidWithServiceMilesOnly
                      ? `${serviceMilesPaid?.toLocaleString()} Service Miles`
                      : typeof request.deliveryFeeCents === 'number'
                        ? formatCurrency(request.deliveryFeeCents)
                        : '-'}
                  </div>
                  {!paidWithServiceMilesOnly &&
                  serviceMilesPaid !== null &&
                  serviceMilesPaid > 0 ? (
                    <div className="text-xs font-medium text-otwGold">
                      + {serviceMilesPaid.toLocaleString()} Service Miles paid
                    </div>
                  ) : null}
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                        needsPayment
                          ? 'bg-amber-500/20 text-amber-200'
                          : 'bg-green-500/20 text-green-300'
                      }`}
                    >
                      {needsPayment ? 'Payment Required' : 'Paid'}
                    </span>
                    {needsPayment ? (
                      <Link
                        href={`/pay/${request.id}`}
                        className="inline-flex items-center justify-center rounded-md bg-otwGold px-3 py-1 text-[11px] font-semibold text-otwBlack transition-all duration-300 hover:bg-otwGold/90"
                      >
                        Pay Now
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white/60">Service Type</div>
                  <div className="flex items-center gap-2 font-medium text-white">
                    <span className="text-xl">
                      {request.serviceType === 'FOOD' ? '🍔' : 
                       request.serviceType === 'STORE' ? '🛒' : 
                       request.serviceType === 'FRAGILE' ? '📦' : '🏁'}
                    </span>
                    {request.serviceType}
                  </div>
                </div>
                {driverName && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-white/60">Driver</div>
                    <div className="flex items-center gap-2 font-medium text-white">
                      <User className="h-4 w-4 text-otwGold" />
                      {driverName}
                      {driverRating && <span className="text-white/60 text-sm">({driverRating.toFixed(1)} ★)</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Lock Status Banner */}
              {request.isLocked && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4" data-testid="lock-banner">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-400">Order Locked ✅</h3>
                      <div className="mt-2 text-sm text-green-300">
                        <p>Order confirmation recorded. This request is protected from automatic refunds.</p>
                        {request.lockedAt && (
                          <p className="mt-1 text-xs text-green-400/80">
                            Locked on {formatDate(request.lockedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-otwGold mt-2" />
                    <div className="h-full w-px bg-white/10 my-1" />
                  </div>
                  <div className="pb-4">
                    <div className="text-sm font-medium text-white/60">Pickup</div>
                    <div className="mt-1 text-white">{request.pickupAddress}</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-otwGold mt-2" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white/60">Dropoff</div>
                    <div className="mt-1 text-white">{request.dropoffAddress}</div>
                  </div>
                </div>
              </div>

              {request.notes && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white/60">Notes</div>
                  <div className="text-sm opacity-80 bg-white/5 p-3 rounded-md border border-white/10 text-white">
                    {request.notes}
                  </div>
                </div>
              )}

              {isOwner ? (
                <RequestRatingPanel
                  requestId={request.id}
                  initialRating={typeof request.customerRating === 'number' ? request.customerRating : null}
                  canRate
                />
              ) : null}

              {canCancelAndRefund ? (
                <div className="space-y-2 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                  <div className="text-sm font-medium text-red-200">Need to cancel?</div>
                  <div className="text-xs text-red-100/80">
                    Cancel this request and submit a refund request. You will be asked to confirm in a popup.
                  </div>
                  <CancelOrderButton orderId={request.id} />
                </div>
              ) : null}

              <PickupVerificationPanel
                requestId={request.id}
                canEdit={canEditPickupDetails}
                pickupPassFeatureEnabled={serverFeatureFlags.pickupPass}
                initialOrderReference={request.orderReference}
                initialPickupInstructions={request.pickupInstructions}
                initialDropoffInstructions={request.dropoffInstructions}
                initialPickupCodeType={request.pickupCodeType}
                initialPickupCodeText={request.pickupCodeText}
                initialPickupPassUploadedAt={request.pickupPassUploadedAt?.toISOString() ?? null}
                initialPickupPassExpiresAt={request.pickupPassExpiresAt?.toISOString() ?? null}
                initialPickupPassExpired={pickupPassExpired}
                initialHasPickupPass={Boolean(request.pickupPassImageUrl || request.pickupPassMimeType)}
              />

              {serverFeatureFlags.chat && (
                chatAvailable ? (
                  <RequestChat
                    requestId={request.id}
                    currentUserId={user.id}
                    currentUserRole={user.role}
                    className="border-white/15"
                  />
                ) : (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/65">
                    Chat opens once a driver is assigned.
                  </div>
                )
              )}

              {isOwner && request.isLocked && (
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <OtwButton as="a" href={`/requests/${request.id}/dispute`} variant="outline">
                    Report an Issue
                  </OtwButton>
                </div>
              )}

              {/* Driver Tracking Section */}
              {['ASSIGNED', 'PICKED_UP', 'EN_ROUTE'].includes(request.status) && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <MapPin className="h-5 w-5 text-otwGold" />
                    Live Tracking
                  </h3>
                  
                  {hasDriverSignal ? (
                    <div className="space-y-3">
                      <div className="h-[300px] w-full rounded-lg overflow-hidden border border-white/10">
                          <TrackMapWrapper
                            drivers={driverLocations}
                            requestId={request.id}
                            initialStatus={request.status}
                          />
                      </div>
                      <div className="text-center space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-otwGold/20 text-otwGold text-sm font-medium animate-pulse">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-otwGold opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-otwGold"></span>
                          </span>
                          Driver Connected
                        </div>
                        <p className="text-sm text-white/60 font-mono">
                          Lat: {request.lastKnownLat!.toFixed(4)} | Lng: {request.lastKnownLng!.toFixed(4)}
                        </p>
                        <p className="text-xs text-white/40">
                          Updated: {formatDate(request.lastKnownAt!)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-black/40 rounded-xl border border-white/10 p-4 h-48 flex items-center justify-center text-center text-white/40">
                      <div>
                        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Waiting for driver location signal...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </OtwCard>
        </div>


      </div>
    </OtwPageShell>
  );
}
