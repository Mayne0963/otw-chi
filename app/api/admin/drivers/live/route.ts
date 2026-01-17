import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { validateAddress } from "@/lib/geocoding";

const ACTIVE_DRIVER_STATUSES = ["ONLINE", "BUSY"] as const;
const ACTIVE_JOB_STATUSES = ["ASSIGNED", "PICKED_UP", "EN_ROUTE"] as const;

const GEOCODE_CACHE_TTL_MS = 12 * 60 * 60_000;
const GEOCODE_CACHE_MAX_ENTRIES = 500;

type CachedGeocode = {
  expires: number;
  value: { lat: number; lng: number; label?: string } | null;
};

const geocodeCache = new Map<string, CachedGeocode>();

const normalizeAddressKey = (address: string) =>
  address.trim().toLowerCase().replace(/\s+/g, " ");

const getCachedGeocode = (key: string) => {
  const entry = geocodeCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    geocodeCache.delete(key);
    return undefined;
  }
  return entry.value;
};

const setCachedGeocode = (key: string, value: CachedGeocode["value"]) => {
  geocodeCache.set(key, { expires: Date.now() + GEOCODE_CACHE_TTL_MS, value });
  if (geocodeCache.size <= GEOCODE_CACHE_MAX_ENTRIES) return;
  const oldestKey = geocodeCache.keys().next().value as string | undefined;
  if (oldestKey) geocodeCache.delete(oldestKey);
};

const geocodeAddress = async (address: string) => {
  const normalized = normalizeAddressKey(address);
  if (!normalized) return null;
  const cached = getCachedGeocode(normalized);
  if (cached !== undefined) return cached;

  let resolved: CachedGeocode["value"] = null;
  try {
    const result = await validateAddress(address);
    if (result) {
      resolved = {
        lat: result.latitude,
        lng: result.longitude,
        label: result.placeName || result.formattedAddress || undefined,
      };
    }
  } catch (_error) {
    resolved = null;
  }

  setCachedGeocode(normalized, resolved);
  return resolved;
};

export async function GET() {
  try {
    await requireRole(["ADMIN"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ success: false, error: message }, { status });
  }

  const prisma = getPrisma();
  const drivers = await prisma.driverProfile.findMany({
    where: { status: { in: [...ACTIVE_DRIVER_STATUSES] } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      telemetry: { orderBy: { recordedAt: "desc" }, take: 1 },
      locationPings: { orderBy: { createdAt: "desc" }, take: 1 },
      locations: { orderBy: { timestamp: "desc" }, take: 1 },
      assignedDeliveryRequests: {
        where: { status: { in: [...ACTIVE_JOB_STATUSES] } },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      requests: {
        where: { status: { in: [...ACTIVE_JOB_STATUSES] } },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  const payload = await Promise.all(
    drivers.map(async (driver) => {
      const telemetry = driver.telemetry[0] ?? null;
      const ping = driver.locationPings[0] ?? null;
      const legacyLocation = driver.locations[0] ?? null;

      const location = telemetry
        ? {
            lat: telemetry.lat,
            lng: telemetry.lng,
            updatedAt: telemetry.recordedAt.toISOString(),
            speedMps: telemetry.speedMps ?? null,
            heading: telemetry.heading ?? null,
          }
        : ping
          ? { lat: ping.lat, lng: ping.lng, updatedAt: ping.createdAt.toISOString() }
          : legacyLocation
            ? {
                lat: legacyLocation.lat,
                lng: legacyLocation.lng,
                updatedAt: legacyLocation.timestamp.toISOString(),
              }
            : null;

      const activeDelivery = driver.assignedDeliveryRequests[0] ?? null;
      const activeRequest = activeDelivery ? null : (driver.requests[0] ?? null);

      if (!activeDelivery && !activeRequest) {
        return {
          driverProfileId: driver.id,
          userId: driver.user.id,
          name: driver.user.name,
          email: driver.user.email,
          status: driver.status,
          location,
          job: null,
        };
      }

      const jobType = activeDelivery ? "delivery" : "legacy";
      const jobId = activeDelivery ? activeDelivery.id : activeRequest!.id;
      const jobStatus = activeDelivery ? activeDelivery.status : activeRequest!.status;
      const pickupAddress = activeDelivery ? activeDelivery.pickupAddress : activeRequest!.pickup;
      const dropoffAddress = activeDelivery ? activeDelivery.dropoffAddress : activeRequest!.dropoff;
      const nextStop = jobStatus === "ASSIGNED" ? "pickup" : "dropoff";
      const targetAddress = nextStop === "pickup" ? pickupAddress : dropoffAddress;
      const targetLocation = targetAddress ? await geocodeAddress(targetAddress) : null;

      return {
        driverProfileId: driver.id,
        userId: driver.user.id,
        name: driver.user.name,
        email: driver.user.email,
        status: driver.status,
        location,
        job: {
          type: jobType,
          id: jobId,
          status: jobStatus,
          pickupAddress,
          dropoffAddress,
          nextStop,
          targetAddress,
          targetLocation,
        },
      };
    })
  );

  return NextResponse.json(
    { success: true, generatedAt: new Date().toISOString(), drivers: payload },
    { headers: { "cache-control": "no-store" } }
  );
}
