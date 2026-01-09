import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Route as RouteIcon, Clock, ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { getPrisma } from "@/lib/db";
import { validateAddress } from "@/lib/geocoding";
import OtwLiveMap from "@/components/otw/OtwLiveMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [delivery, request] = await Promise.all([
    prisma.deliveryRequest.findUnique({
      where: { id },
      include: { assignedDriver: { include: { user: true } } },
    }),
    prisma.request.findUnique({
      where: { id },
      include: { assignedDriver: { include: { user: true } }, events: { orderBy: { timestamp: "desc" }, take: 1 } },
    }),
  ]);

  const record = delivery ?? request;
  if (!record) {
    return (
      <div className="otw-container otw-section space-y-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/track">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="text-lg font-semibold">Tracking Not Found</div>
        </div>
        <p className="text-sm text-muted-foreground">We could not find a delivery or request with that ID.</p>
      </div>
    );
  }

  const isDelivery = Boolean(delivery);
  const ownerId = isDelivery ? delivery!.userId : request!.customerId;
  const assignedDriverUserId = record.assignedDriver?.userId;
  const isOwner = ownerId === user.id;
  const isAssignedDriver = assignedDriverUserId === user.id;
  const isAdmin = user.role === "ADMIN";

  if (!isOwner && !isAssignedDriver && !isAdmin) {
    return (
      <div className="otw-container otw-section space-y-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/track">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="text-lg font-semibold">Unauthorized</div>
        </div>
        <p className="text-sm text-muted-foreground">
          You do not have permission to view this tracking page.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/support">Contact support</Link>
          </Button>
        </div>
      </div>
    );
  }

  const pickupText = isDelivery ? delivery!.pickupAddress : request!.pickup;
  const dropoffText = isDelivery ? delivery!.dropoffAddress : request!.dropoff;
  const statusText = normalizeStatus(
    isDelivery ? delivery!.status : request!.status
  );
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
    <div className="otw-container otw-section space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/track">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {isDelivery ? "Delivery" : "Request"}
            </div>
            <div className="text-xl font-semibold">
              Tracking {record.id.slice(-6).toUpperCase()}
            </div>
          </div>
        </div>
        <Badge variant="outline">{statusText}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RouteIcon className="h-4 w-4 text-secondary" />
              Route preview
            </CardTitle>
            <CardDescription>Read-only view of your current trip.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pickupLocation || dropoffLocation ? (
              <OtwLiveMap
                pickup={pickupLocation ?? undefined}
                dropoff={dropoffLocation ?? undefined}
                customer={dropoffLocation ?? undefined}
                requestId={record.id}
                jobStatus={statusText}
                drivers={driverLocations}
                focusDriverId={driverLocations[0]?.driverId}
                useExternalRoutes
              />
            ) : (
              <div className="rounded-lg border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                We need pickup and dropoff coordinates to show the map. This route will be displayed
                once locations are available.
              </div>
            )}
            {driverLocations.length === 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                Waiting for driver location updates. You’ll see live position once the driver starts sharing.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>Latest delivery snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current state</span>
                <Badge variant="secondary">{statusText}</Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Created {formatDate(record.createdAt)}</span>
              </div>
              {lastKnownAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Last update {formatDate(lastKnownAt)}</span>
                </div>
              )}
              {driverLabel && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs uppercase tracking-[0.2em]">Driver</span>
                  <span className="text-foreground">{driverLabel}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Route</CardTitle>
              <CardDescription>Addresses we have on file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pickup</div>
                <div className="text-foreground">{pickupText}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dropoff</div>
                <div className="text-foreground">{dropoffText}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Need help? We’re here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Button asChild className="w-full">
                <Link href={isDelivery ? `/order/${record.id}` : `/requests/${record.id}`}>
                  View details
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/support">Contact support</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
