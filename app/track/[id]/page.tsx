import { redirect } from "next/navigation";
import { Route as RouteIcon, ArrowLeft, Clock, MapPin } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { getPrisma } from "@/lib/db";
import { validateAddress } from "@/lib/geocoding";
import TrackMapWrapper from "@/components/otw/TrackMapWrapper";
import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import OtwSectionHeader from "@/components/ui/otw/OtwSectionHeader";
import OtwCard from "@/components/ui/otw/OtwCard";
import OtwButton from "@/components/ui/otw/OtwButton";
import { formatDate } from "@/lib/utils";
import type { OtwDriverLocation } from "@/lib/otw/otwDriverLocation";
import type { OtwLocation } from "@/lib/otw/otwTypes";

export const dynamic = "force-dynamic";

const normalizeStatus = (status?: string | null) =>
  status ? status.replace(/_/g, " ") : "UNKNOWN";

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/sign-in?redirect_url=/track/${id}`);
  }

  const prisma = getPrisma();
  const record = await prisma.deliveryRequest.findUnique({
    where: { id },
    include: { assignedDriver: { include: { user: true } } },
  });
  if (!record) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Tracking Not Found" subtitle="We could not find a delivery with that ID." />
        <OtwButton as="a" href="/track" variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tracking
        </OtwButton>
      </OtwPageShell>
    );
  }

  const ownerId = record.userId;
  const assignedDriverUserId = record.assignedDriver?.userId;
  const isOwner = ownerId === user.id;
  const isAssignedDriver = assignedDriverUserId === user.id;
  const isAdmin = user.role === "ADMIN";

  if (!isOwner && !isAssignedDriver && !isAdmin) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Unauthorized" subtitle="You do not have permission to view this tracking page." />
        <div className="flex gap-4 mt-6">
          <OtwButton as="a" href="/dashboard" variant="outline">Go to dashboard</OtwButton>
          <OtwButton as="a" href="/support" variant="ghost">Contact support</OtwButton>
        </div>
      </OtwPageShell>
    );
  }

  const pickupText = record.pickupAddress;
  const dropoffText = record.dropoffAddress;
  const statusText = normalizeStatus(record.status);
  const lastKnownLat = record.lastKnownLat;
  const lastKnownLng = record.lastKnownLng;
  const lastKnownAt = record.lastKnownAt;
  const driverLabel =
    record.assignedDriver?.user?.name || record.assignedDriver?.id || "Driver";

  let pickupLocation: OtwLocation | null = null;
  let dropoffLocation: OtwLocation | null = null;
  const toOtwLocation = (addr: Awaited<ReturnType<typeof validateAddress>> | null, label: string) =>
    addr
      ? {
          lat: addr.latitude,
          lng: addr.longitude,
          label: addr.placeName || addr.formattedAddress || label,
        }
      : null;

  try {
    const geo = pickupText ? await validateAddress(pickupText).catch(() => null) : null;
    pickupLocation = toOtwLocation(geo, "Pickup");
  } catch (_error) {
    pickupLocation = null;
  }
  try {
    const geo = dropoffText ? await validateAddress(dropoffText).catch(() => null) : null;
    dropoffLocation = toOtwLocation(geo, "Dropoff");
  } catch (_error) {
    dropoffLocation = null;
  }

  const driverLocations: OtwDriverLocation[] =
    typeof lastKnownLat === "number" &&
    typeof lastKnownLng === "number" &&
    !Number.isNaN(lastKnownLat) &&
    !Number.isNaN(lastKnownLng)
      ? [
          {
            driverId: driverLabel,
            location: { lat: lastKnownLat, lng: lastKnownLng, label: driverLabel },
            updatedAt: (lastKnownAt ?? new Date()).toISOString(),
            currentRequestId: record.id,
          },
        ]
      : [];

  return (
    <OtwPageShell>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
           <OtwButton as="a" href="/track" variant="ghost" size="sm" className="mb-2 -ml-2">
               <ArrowLeft className="h-4 w-4 mr-2" />
               Back
           </OtwButton>
           <OtwSectionHeader 
              title={`Tracking ${record.id.slice(-6).toUpperCase()}`} 
              subtitle="Delivery Details" 
           />
        </div>
        <span className="bg-white/10 text-white px-3 py-1 rounded-full text-sm font-medium border border-white/10 uppercase tracking-wide">
            {statusText}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <OtwCard>
              <div className="p-4 border-b border-white/10">
                <h3 className="flex items-center gap-2 text-lg font-medium text-white">
                  <RouteIcon className="h-4 w-4 text-otwGold" />
                  Route preview
                </h3>
                <p className="text-sm text-white/50 mt-1">Read-only view of your current trip.</p>
              </div>
              <div className="p-0 overflow-hidden">
                {pickupLocation || dropoffLocation ? (
                  <div className="h-[500px] w-full relative">
                      <TrackMapWrapper
                        pickup={pickupLocation ?? undefined}
                        dropoff={dropoffLocation ?? undefined}
                        customer={dropoffLocation ?? undefined}
                        requestId={record.id}
                        initialStatus={statusText}
                        drivers={driverLocations}
                        focusDriverId={driverLocations[0]?.driverId}
                        useExternalRoutes
                      />
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-white/50 bg-white/5">
                    We need pickup and dropoff coordinates to show the map. This route will be displayed
                    once locations are available.
                  </div>
                )}
              </div>
              {driverLocations.length === 0 && (pickupLocation || dropoffLocation) && (
                  <div className="p-3 text-xs text-white/50 bg-otwGold/10 border-t border-otwGold/20 text-center">
                    Waiting for driver location updates. You’ll see live position once the driver starts sharing.
                  </div>
                )}
            </OtwCard>
        </div>

        <div className="space-y-4">
          <OtwCard>
             <div className="p-4 border-b border-white/10 mb-4">
                <h3 className="text-lg font-medium text-white">Status</h3>
                <p className="text-sm text-white/50">Latest delivery snapshot.</p>
             </div>
             <div className="space-y-3 text-sm px-4 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Current state</span>
                <span className="bg-white/10 text-white px-2 py-0.5 rounded text-xs font-medium uppercase">{statusText}</span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <Clock className="h-4 w-4" />
                <span>Created {formatDate(record.createdAt)}</span>
              </div>
              {lastKnownAt && (
                <div className="flex items-center gap-2 text-white/70">
                  <MapPin className="h-4 w-4" />
                  <span>Last update {formatDate(lastKnownAt)}</span>
                </div>
              )}
              {driverLabel && (
                <div className="flex items-center gap-2 text-white/70">
                  <span className="text-xs uppercase tracking-[0.2em]">Driver</span>
                  <span className="text-white">{driverLabel}</span>
                </div>
              )}
            </div>
          </OtwCard>

          <OtwCard>
            <div className="p-4 border-b border-white/10 mb-4">
                <h3 className="text-lg font-medium text-white">Route</h3>
                <p className="text-sm text-white/50">Addresses we have on file.</p>
            </div>
            <div className="space-y-3 text-sm px-4 pb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/50">Pickup</div>
                <div className="text-white">{pickupText}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/50">Dropoff</div>
                <div className="text-white">{dropoffText}</div>
              </div>
            </div>
          </OtwCard>

          <OtwCard>
            <div className="p-4 border-b border-white/10 mb-4">
                <h3 className="text-lg font-medium text-white">Actions</h3>
                <p className="text-sm text-white/50">Need help? We’re here.</p>
            </div>
            <div className="space-y-2 text-sm px-4 pb-4">
              <OtwButton as="a" href={`/order/${record.id}`} className="w-full">
                  View details
              </OtwButton>
              <OtwButton as="a" href="/support" variant="outline" className="w-full">
                  Contact support
              </OtwButton>
            </div>
          </OtwCard>
        </div>
      </div>
    </OtwPageShell>
  );
}
