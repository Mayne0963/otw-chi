"use client";

import { useEffect, useState } from "react";
import OtwLiveMap, { OtwLiveMapProps } from "./OtwLiveMap";
import { OtwDriverLocation } from "@/lib/otw/otwDriverLocation";

interface TrackMapWrapperProps extends OtwLiveMapProps {
  initialStatus?: string;
}

export default function TrackMapWrapper(props: TrackMapWrapperProps) {
  const [drivers, setDrivers] = useState<OtwDriverLocation[]>(
    props.drivers || []
  );
  const [status, setStatus] = useState<string>(
    props.initialStatus || props.jobStatus || "UNKNOWN"
  );

  useEffect(() => {
    if (!props.requestId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/requests/${props.requestId}/tracking`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status) setStatus(data.status);

        if (data.driver && data.driver.location) {
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
      }
    };

    // Initial fetch to ensure we're fresh
    fetchStatus();

    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [props.requestId]);

  return <OtwLiveMap {...props} drivers={drivers} jobStatus={status} />;
}
