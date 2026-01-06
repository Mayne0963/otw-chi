"use client";

import { useEffect, useRef, useState } from "react";
import OtwLiveMap from "./OtwLiveMap";
import type { OtwLocation } from "@/lib/otw/otwTypes";
import type { OtwDriverLocation } from "@/lib/otw/otwDriverLocation";
import { haversineDistanceKm } from "@/lib/otw/otwGeo";

interface DriverLiveMapProps {
  driverId: string;
  requestId?: string;
  jobStatus?: string;
  pickup?: OtwLocation;
  dropoff?: OtwLocation;
  customer?: OtwLocation;
  initialDriverLocation?: OtwDriverLocation | null;
}

type TrackingStatus = "idle" | "requesting" | "active" | "denied" | "unsupported" | "error";

const MIN_SEND_INTERVAL_MS = 15_000;
const MIN_DISTANCE_KM = 0.03; // ~30m
const FAILURE_BACKOFF_MS = 60_000;

const formatTime = (iso?: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const DriverLiveMap = ({
  driverId,
  requestId,
  jobStatus,
  pickup,
  dropoff,
  customer,
  initialDriverLocation,
}: DriverLiveMapProps) => {
  const [driverLocations, setDriverLocations] = useState<OtwDriverLocation[]>(() =>
    initialDriverLocation ? [initialDriverLocation] : []
  );
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(
    initialDriverLocation?.updatedAt ?? null
  );
  const lastSentRef = useRef<{ lat: number; lng: number; at: number } | null>(
    initialDriverLocation
      ? {
          lat: initialDriverLocation.location.lat,
          lng: initialDriverLocation.location.lng,
          at: Number.isFinite(Date.parse(initialDriverLocation.updatedAt))
            ? Date.parse(initialDriverLocation.updatedAt)
            : Date.now(),
        }
      : null
  );

  const backoffUntilRef = useRef<number>(0);
  const syncDisabledRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setTrackingStatus("unsupported");
      setLocationError("Location services are not available in this browser.");
      return;
    }

    setTrackingStatus("requesting");
    setLocationError(null);

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const updatedAt = new Date().toISOString();

        setDriverLocations([
          {
            driverId,
            location: { lat, lng, label: "You" },
            updatedAt,
            currentRequestId: requestId,
          },
        ]);

        setTrackingStatus("active");

        const last = lastSentRef.current;
        const now = Date.now();
        const distanceKm = last
          ? haversineDistanceKm({ lat: last.lat, lng: last.lng }, { lat, lng })
          : Number.POSITIVE_INFINITY;
        const shouldSend =
          !last ||
          now - last.at > MIN_SEND_INTERVAL_MS ||
          distanceKm > MIN_DISTANCE_KM;

        if (!shouldSend) return;
        if (syncDisabledRef.current) return;
        if (now < backoffUntilRef.current) return;

        lastSentRef.current = { lat, lng, at: now };
        setLastSentAt(updatedAt);

        try {
          setSyncError(null);
          const pingRes = await fetch("/api/driver/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng }),
          });
          if (!pingRes.ok) {
            const message = await pingRes.text().catch(() => "");
            if (pingRes.status === 401 || pingRes.status === 403) {
              syncDisabledRef.current = true;
              setSyncError("Location sync requires a signed-in driver account.");
              return;
            }
            if (pingRes.status === 404) {
              syncDisabledRef.current = true;
              setSyncError("Driver profile not found. Complete driver setup to sync live location.");
              return;
            }
            throw new Error(
              `Location ping failed with status ${pingRes.status}${message ? `: ${message}` : ""}`
            );
          }
          const pingPayload = (await pingRes.json().catch(() => null)) as
            | { warning?: string }
            | null;
          if (pingPayload?.warning) {
            setSyncError(pingPayload.warning);
          }
          const otwRes = await fetch("/api/otw/driver/location", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              driverId,
              lat,
              lng,
              label: "You",
              currentRequestId: requestId ?? undefined,
            }),
          });
          if (!otwRes.ok) {
            const message = await otwRes.text().catch(() => "");
            throw new Error(
              `OTW location sync failed with status ${otwRes.status}${message ? `: ${message}` : ""}`
            );
          }

          backoffUntilRef.current = 0;
        } catch (err) {
          console.error("Failed to sync driver location:", err);
          backoffUntilRef.current = Date.now() + FAILURE_BACKOFF_MS;
          setSyncError("Unable to sync location. Check your connection and try again.");
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setTrackingStatus("denied");
          setLocationError("Location permission was denied. Enable it to share live position.");
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          setTrackingStatus("error");
          setLocationError("Location is unavailable. Make sure your device can access GPS.");
          return;
        }
        setTrackingStatus("error");
        setLocationError("Unable to access your location right now.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 12_000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [driverId, requestId]);

  const statusCopy = (() => {
    switch (trackingStatus) {
      case "requesting":
        return "Requesting location permission...";
      case "active":
        return "Live location is on.";
      case "denied":
        return "Location permission denied.";
      case "unsupported":
        return "Location is not supported in this browser.";
      case "error":
        return "Location tracking is unavailable.";
      default:
        return "Location tracking is idle.";
    }
  })();

  return (
    <div className="space-y-3">
      <OtwLiveMap
        customer={customer}
        pickup={pickup}
        dropoff={dropoff}
        requestId={requestId}
        jobStatus={jobStatus}
        focusDriverId={driverId}
        drivers={driverLocations}
      />
      <div
        className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground/80">Location status:</span>
          <span>{statusCopy}</span>
          {lastSentAt && (
            <span className="text-muted-foreground">Last sent {formatTime(lastSentAt)}.</span>
          )}
        </div>
        {locationError && <div className="mt-1 text-red-400">{locationError}</div>}
        {syncError && <div className="mt-1 text-amber-300">{syncError}</div>}
      </div>
    </div>
  );
};

export default DriverLiveMap;
