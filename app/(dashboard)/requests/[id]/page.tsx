import { getRequest } from '@/app/actions/request';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { formatDate, formatCurrency } from '@/lib/utils';
import { MapPin, User, ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import TrackMapWrapper from '@/components/otw/TrackMapWrapper';
import type { OtwDriverLocation } from '@/lib/otw/otwDriverLocation';

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
  const isOwner = request.customerId === user.id;
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
                      request.status === 'COMPLETED' || request.status === 'DELIVERED' ? 'bg-green-500/20 text-green-400' :
                      request.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                      request.status === 'ASSIGNED' || request.status === 'PICKED_UP' ? 'bg-otwGold/20 text-otwGold' :
                      'bg-white/10 text-white/70'
                  }`}>
                    {request.status}
                  </span>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-sm font-medium text-white/60">Cost</div>
                  <div className="text-xl font-bold text-white">
                    {request.costEstimate ? formatCurrency(request.costEstimate / 100) : '-'}
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

              <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-otwGold mt-2" />
                    <div className="h-full w-px bg-white/10 my-1" />
                  </div>
                  <div className="pb-4">
                    <div className="text-sm font-medium text-white/60">Pickup</div>
                    <div className="mt-1 text-white">{request.pickup}</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-otwGold mt-2" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white/60">Dropoff</div>
                    <div className="mt-1 text-white">{request.dropoff}</div>
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

        {/* Right Column: Timeline */}
        <div className="space-y-6">
          <OtwCard>
            <div className="p-4 border-b border-white/10 mb-4">
                <h3 className="text-lg font-medium text-white">Timeline</h3>
                <p className="text-sm text-white/50">History of this request.</p>
            </div>
            <div className="p-4 pt-0">
              <div className="relative space-y-6 pl-4 before:absolute before:left-[5px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-white/10">
                {request.events && request.events.length > 0 ? (
                  request.events.map((event: { id: string; type: string; timestamp: Date; message: string | null }) => (
                    <div key={event.id} className="relative flex gap-4">
                      <div className="absolute -left-[15px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-otwGold bg-otwBlack ring-4 ring-otwBlack" />
                      <div className="space-y-1">
                        <div className="text-sm font-medium leading-none text-white">
                          {event.type.replace('STATUS_', '').replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-white/60">
                          {formatDate(event.timestamp)}
                        </div>
                        {event.message && (
                          <div className="text-xs text-white/50 mt-1">
                            {event.message}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/60">No events yet.</div>
                )}
              </div>
            </div>
          </OtwCard>
        </div>
      </div>
    </OtwPageShell>
  );
}
