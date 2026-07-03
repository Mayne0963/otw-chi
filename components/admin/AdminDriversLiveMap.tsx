"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import OtwLiveMap from "@/components/otw/OtwLiveMap";
import type { OtwDriverLocation } from "@/lib/otw/otwDriverLocation";

type LiveDriverLocation = {
  lat: number;
  lng: number;
  updatedAt: string;
  speedMps?: number | null;
  heading?: number | null;
};

type LiveDriverJob = {
  type: "delivery" | "legacy";
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  nextStop: "pickup" | "dropoff";
  targetAddress: string;
  targetLocation: { lat: number; lng: number; label?: string } | null;
};

type LiveDriver = {
  driverProfileId: string;
  userId: string;
  name: string | null;
  email: string;
  status: string;
  location: LiveDriverLocation | null;
  job: LiveDriverJob | null;
};

type LiveDriversResponse =
  | {
      success: true;
      generatedAt: string;
      drivers: LiveDriver[];
    }
  | {
      success: false;
      error: string;
      retryAfter?: number;
    };

const POLL_MS = 10_000;
const POLL_JITTER_MS = 350;
const ROUTE_REFRESH_MS = 45_000;
const ROUTE_REFRESH_DISTANCE_KM = 0.2;
const MAX_ROUTE_FETCHES_PER_TICK = 4;

type RouteEntry = {
  origin: [number, number];
  destination: [number, number];
  updatedAt: number;
  feature: GeoJSON.Feature<GeoJSON.LineString>;
};

const toRadians = (deg: number) => (deg * Math.PI) / 180;

const haversineDistanceKm = (a: [number, number], b: [number, number]) => {
  const R = 6371;
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const buildFallbackLine = (origin: [number, number], destination: [number, number]) => ({
  type: "Feature" as const,
  geometry: {
    type: "LineString" as const,
    coordinates: [origin, destination],
  },
  properties: {},
});

const fetchOsrmRoute = async (origin: [number, number], destination: [number, number], signal: AbortSignal) => {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`OSRM route failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (coords?.length) {
      return {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: coords },
        properties: {},
      };
    }
  } catch (error) {
    if (signal.aborted) return null;
    console.warn("[AdminDriversLiveMap] Route fallback:", error);
  }

  return buildFallbackLine(origin, destination);
};

const getDriverLabel = (driver: LiveDriver) => driver.name || driver.email || driver.driverProfileId;

export default function AdminDriversLiveMap() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [driverRoutes, setDriverRoutes] = useState<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(
    null
  );

  const routesRef = useRef<Map<string, RouteEntry>>(new Map());
  const pollInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(load, delay);
    };

    const load = async () => {
      let nextDelayMs = POLL_MS + POLL_JITTER_MS;
      if (cancelled) return;
      if (pollInFlightRef.current) {
        schedule(nextDelayMs);
        return;
      }
      pollInFlightRef.current = true;
      try {
        const res = await fetch("/api/admin/drivers/live", {
          cache: "no-store",
          credentials: "include",
        });
        const data = (await res.json().catch(() => null)) as LiveDriversResponse | null;

        if (res.status === 429) {
          const retryAfterHeader = Number.parseInt(res.headers.get("Retry-After") || "", 10);
          const retryAfterBody =
            data && "retryAfter" in data && typeof data.retryAfter === "number"
              ? data.retryAfter
              : null;
          const retryAfterSeconds =
            Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
              ? retryAfterHeader
              : retryAfterBody && retryAfterBody > 0
                ? retryAfterBody
                : Math.ceil(POLL_MS / 1000);

          nextDelayMs = retryAfterSeconds * 1000 + POLL_JITTER_MS;
          setError(`Too many requests. Retrying in ${retryAfterSeconds}s.`);
          setLoading(false);
          return;
        }

        if (!res.ok || !data || data.success !== true) {
          const errorMessage =
            data && "error" in data && typeof data.error === "string"
              ? data.error
              : `Request failed: ${res.status}`;
          throw new Error(errorMessage);
        }
        if (cancelled) return;
        setDrivers(data.drivers || []);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load driver locations.");
        setLoading(false);
      } finally {
        pollInFlightRef.current = false;
        schedule(nextDelayMs);
      }
    };

    load();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  const mapDrivers: OtwDriverLocation[] = useMemo(() => {
    return drivers
      .filter((driver) => Boolean(driver.location))
      .map((driver) => ({
        driverId: driver.driverProfileId,
        label: getDriverLabel(driver),
        location: {
          lat: driver.location!.lat,
          lng: driver.location!.lng,
        },
        updatedAt: driver.location!.updatedAt,
        currentRequestId: driver.job?.id,
      }));
  }, [drivers]);

  useEffect(() => {
    const active = drivers.filter(
      (driver) =>
        Boolean(driver.location) &&
        Boolean(driver.job?.targetLocation) &&
        driver.status === "BUSY"
    );

    const desiredIds = new Set(active.map((driver) => driver.driverProfileId));
    routesRef.current.forEach((_value, key) => {
      if (!desiredIds.has(key)) routesRef.current.delete(key);
    });

    if (active.length === 0) {
      setDriverRoutes(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const tasks = active
      .map((driver) => {
        const origin: [number, number] = [driver.location!.lng, driver.location!.lat];
        const destination: [number, number] = [
          driver.job!.targetLocation!.lng,
          driver.job!.targetLocation!.lat,
        ];
        const existing = routesRef.current.get(driver.driverProfileId);
        const movedKm = existing ? haversineDistanceKm(existing.origin, origin) : Number.POSITIVE_INFINITY;
        const destinationMovedKm = existing
          ? haversineDistanceKm(existing.destination, destination)
          : Number.POSITIVE_INFINITY;
        const staleMs = existing ? Date.now() - existing.updatedAt : Number.POSITIVE_INFINITY;
        const needsRefresh =
          !existing ||
          movedKm >= ROUTE_REFRESH_DISTANCE_KM ||
          destinationMovedKm >= 0.05 ||
          staleMs >= ROUTE_REFRESH_MS;

        return needsRefresh
          ? {
              driver,
              origin,
              destination,
              existingUpdatedAt: existing?.updatedAt ?? 0,
            }
          : null;
      })
      .filter((task): task is NonNullable<typeof task> => Boolean(task))
      .sort((a, b) => a.existingUpdatedAt - b.existingUpdatedAt);

    const rebuildFeatureCollection = () => {
      const features = Array.from(routesRef.current.entries()).map(([driverId, entry]) => ({
        ...entry.feature,
        properties: {
          ...(entry.feature.properties || {}),
          driverId,
          color: "#0a84ff",
        },
      }));
      setDriverRoutes(features.length ? { type: "FeatureCollection", features } : null);
    };

    const run = async () => {
      for (const task of tasks.slice(0, MAX_ROUTE_FETCHES_PER_TICK)) {
        if (cancelled) break;
        const feature = await fetchOsrmRoute(task.origin, task.destination, controller.signal);
        if (cancelled || controller.signal.aborted || !feature) break;
        routesRef.current.set(task.driver.driverProfileId, {
          origin: task.origin,
          destination: task.destination,
          updatedAt: Date.now(),
          feature,
        });
      }
      if (cancelled) return;
      rebuildFeatureCollection();
    };

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [drivers]);

  return (
    <div className="h-full w-full">
      {error && (
        <div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}
      {loading && mapDrivers.length === 0 ? (
        <div className="h-[320px] w-full animate-pulse rounded-xl border border-border/70 bg-muted/40" />
      ) : (
        <OtwLiveMap drivers={mapDrivers} driverRoutes={driverRoutes} useExternalRoutes showAllDrivers />
      )}
    </div>
  );
}
