"use client";

import { useEffect, useState } from "react";
import OtwLiveMap, { OtwLiveMapProps } from "./OtwLiveMap";
import { OtwDriverLocation } from "@/lib/otw/otwDriverLocation";

interface TrackMapWrapperProps extends OtwLiveMapProps {
  initialStatus?: string;
}

type TrackingResponse = {
  status?: string;
  driver?: {
    id: string;
    name?: string;
    location?: {
      lat: number;
      lng: number;
      updatedAt: string;
    } | null;
  } | null;
  retryAfter?: number;
  error?: string;
};

const POLL_MS = 10_000;
const POLL_JITTER_MS = 350;

export default function TrackMapWrapper(props: TrackMapWrapperProps) {
  const [drivers, setDrivers] = useState<OtwDriverLocation[]>(
    props.drivers || []
  );
  const [status, setStatus] = useState<string>(
    props.initialStatus || props.jobStatus || "UNKNOWN"
  );

  useEffect(() => {
    if (!props.requestId) return;

    let cancelled = false;
    let timeoutId: number | null = null;
    let inFlight = false;

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(fetchStatus, delay);
    };

    const fetchStatus = async () => {
      let nextDelayMs = POLL_MS + POLL_JITTER_MS;

      if (cancelled) return;
      if (inFlight) {
        schedule(nextDelayMs);
        return;
      }

      inFlight = true;
      try {
        const res = await fetch(`/api/requests/${props.requestId}/tracking`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as TrackingResponse | null;

        if (res.status === 429) {
          const retryAfterHeader = Number.parseInt(res.headers.get("Retry-After") || "", 10);
          const retryAfterBody = data?.retryAfter;
          const retryAfterSeconds =
            Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
              ? retryAfterHeader
              : typeof retryAfterBody === "number" && retryAfterBody > 0
                ? retryAfterBody
                : Math.ceil(POLL_MS / 1000);
          nextDelayMs = retryAfterSeconds * 1000 + POLL_JITTER_MS;
          return;
        }

        if (!res.ok || !data) return;

        if (data.status) setStatus(data.status);

        if (data.driver?.location) {
          const newDriver: OtwDriverLocation = {
            driverId: data.driver.id,
            location: {
              lat: data.driver.location.lat,
              lng: data.driver.location.lng,
              label: data.driver.name,
            },
            updatedAt: data.driver.location.updatedAt,
            currentRequestId: props.requestId,
          };
          setDrivers([newDriver]);
        }
      } catch (e) {
        console.error("Polling error", e);
      } finally {
        inFlight = false;
        schedule(nextDelayMs);
      }
    };

    fetchStatus();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [props.requestId]);

  return <OtwLiveMap {...props} drivers={drivers} jobStatus={status} />;
}
