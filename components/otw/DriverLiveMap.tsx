"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import OtwLiveMap from "./OtwLiveMap";
import type { OtwLocation } from "@/lib/otw/otwTypes";
import type { OtwDriverLocation } from "@/lib/otw/otwDriverLocation";
import { haversineDistanceKm } from "@/lib/otw/otwGeo";
import {
  buildGuidanceState,
  buildTurnMarkers,
  type GuidanceState,
  type TurnMarker,
} from "@/lib/navigation/guidance";
import type { NavigationRoute } from "@/lib/navigation/here";

interface DriverLiveMapProps {
  driverId: string;
  requestId?: string;
  requestType?: "delivery" | "legacy";
  jobStatus?: string;
  pickup?: OtwLocation;
  dropoff?: OtwLocation;
  customer?: OtwLocation;
  initialDriverLocation?: OtwDriverLocation | null;
}

type TrackingStatus = "idle" | "requesting" | "active" | "denied" | "unsupported" | "error";

type DriverNavigationSettings = {
  voiceEnabled: boolean;
  voiceLocale: "en-US" | "es-US";
  voiceVolume: number;
  detailLevel: "compact" | "standard" | "detailed";
};

type WeatherSummary = {
  temperature?: number;
  description?: string;
  precipitationDesc?: string;
  precipitationIntensity?: number;
  visibility?: number;
  windSpeed?: number;
  windDirection?: number;
  humidity?: number;
};

type BatteryManager = {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

type RouteSummary = {
  distanceText: string;
  durationText: string;
};

const DEFAULT_SETTINGS: DriverNavigationSettings = {
  voiceEnabled: true,
  voiceLocale: "en-US",
  voiceVolume: 0.7,
  detailLevel: "standard",
};

const MIN_SEND_INTERVAL_MS = 15_000;
const MIN_DISTANCE_KM = 0.03;
const FAILURE_BACKOFF_MS = 60_000;

const ROUTE_REFRESH_MS = 15_000;
const TRAFFIC_REFRESH_MS = 30_000;
const WEATHER_REFRESH_MS = 5 * 60_000;
const POI_REFRESH_MS = 2 * 60_000;

const OFF_ROUTE_THRESHOLD_METERS = 50;
const OFF_ROUTE_GRACE_MS = 10_000;

const TURN_MARKER_DISTANCES = [300, 100, 50];

const toRadians = (deg: number) => (deg * Math.PI) / 180;

const formatDistance = (meters?: number, locale = "en-US") => {
  if (typeof meters !== "number" || Number.isNaN(meters)) return "—";
  const useMiles = locale.toLowerCase().endsWith("us") || locale.toLowerCase().startsWith("en");
  if (useMiles) {
    const feet = meters * 3.28084;
    if (feet < 1000) return `${Math.round(feet)} ft`;
    const miles = meters / 1609.34;
    return `${miles >= 10 ? miles.toFixed(0) : miles.toFixed(1)} mi`;
  }
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
};

const formatDuration = (seconds?: number) => {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) return "—";
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(0, Math.round(seconds / 60))} min`;
};

const formatTime = (iso?: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatSpeed = (mps?: number, locale = "en-US") => {
  if (typeof mps !== "number" || Number.isNaN(mps)) return "—";
  if (locale.toLowerCase().endsWith("us") || locale.toLowerCase().startsWith("en")) {
    return `${Math.round(mps * 2.23694)} mph`;
  }
  return `${Math.round(mps * 3.6)} km/h`;
};

const formatDistanceSpeech = (meters: number, locale: string) => {
  const lower = locale.toLowerCase();
  const isSpanish = lower.startsWith("es");
  if (lower.endsWith("us") || lower.startsWith("en") || isSpanish) {
    const feet = meters * 3.28084;
    const feetLabel = isSpanish ? "pies" : "feet";
    const milesLabel = isSpanish ? "millas" : "miles";
    if (feet < 1000) return `${Math.round(feet)} ${feetLabel}`;
    const miles = meters / 1609.34;
    return `${miles >= 1 ? miles.toFixed(1) : miles.toFixed(2)} ${milesLabel}`;
  }
  const kmLabel = isSpanish ? "kilómetros" : "kilometers";
  const meterLabel = isSpanish ? "metros" : "meters";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} ${kmLabel}`;
  return `${Math.round(meters)} ${meterLabel}`;
};

const computeBearing = (from: OtwLocation, to: OtwLocation) => {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

const getJobPhase = (status?: string): "TO_PICKUP" | "TO_DROPOFF" | "NONE" => {
  const normalized = String(status || "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();

  if (!normalized) return "TO_PICKUP";
  if (["DELIVERED", "COMPLETED", "CANCELED", "CANCELLED"].includes(normalized)) {
    return "NONE";
  }
  if (["PICKED_UP", "EN_ROUTE"].includes(normalized)) {
    return "TO_DROPOFF";
  }
  if (["ASSIGNED", "MATCHED", "ACCEPTED"].includes(normalized)) {
    return "TO_PICKUP";
  }
  return "TO_PICKUP";
};

const buildTurnMarkerCollection = (
  markers: TurnMarker[]
): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: "FeatureCollection",
  features: markers.map((marker) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: marker.coordinate },
    properties: { label: `${Math.round(marker.distanceMeters)}m` },
  })),
});

const buildInstructionText = (
  maneuver?: GuidanceState["nextManeuver"],
  detailLevel: DriverNavigationSettings["detailLevel"] = "standard"
) => {
  if (!maneuver) return "Continue";
  if (maneuver.instruction) return maneuver.instruction;
  const action = maneuver.action ? maneuver.action.replace(/_/g, " ").toLowerCase() : "continue";
  const direction = maneuver.direction ? maneuver.direction.toLowerCase() : "";
  const road = maneuver.roadName;
  if (detailLevel === "detailed" && road) {
    return `${action} ${direction}`.trim() + ` onto ${road}`;
  }
  return `${action} ${direction}`.trim();
};

const DriverLiveMap = ({
  driverId,
  requestId,
  requestType = "delivery",
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
  const [navSettings, setNavSettings] = useState<DriverNavigationSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [routeOptions, setRouteOptions] = useState<NavigationRoute[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [mainRoute, setMainRoute] = useState<NavigationRoute | null>(null);
  const [guidance, setGuidance] = useState<GuidanceState | null>(null);
  const [turnMarkers, setTurnMarkers] = useState<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(
    null
  );
  const [trafficFlow, setTrafficFlow] = useState<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(
    null
  );
  const [incidents, setIncidents] = useState<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null);
  const [pois, setPois] = useState<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null);
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [speedMps, setSpeedMps] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState<boolean | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [offRoute, setOffRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

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
  const lastPositionRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const backoffUntilRef = useRef<number>(0);
  const syncDisabledRef = useRef(false);
  const currentLocationRef = useRef<OtwLocation | null>(null);
  const targetRef = useRef<OtwLocation | null>(null);
  const rerouteInFlightRef = useRef(false);
  const offRouteSinceRef = useRef<number | null>(null);
  const lastDistanceRef = useRef<number | null>(null);
  const lastManeuverIdRef = useRef<string | null>(null);
  const spokenRef = useRef<Set<string>>(new Set());
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const settingsSaveTimeout = useRef<number | null>(null);
  const lastRerouteAtRef = useRef<number>(0);
  const lastWeatherFetchRef = useRef<number>(0);
  const lastRouteRefreshRef = useRef<number>(0);
  const lastPoiFetchRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const batteryRef = useRef<{ level?: number; charging?: boolean } | null>(null);

  const jobPhase = getJobPhase(jobStatus);
  const targetLocation = useMemo(() => {
    if (jobPhase === "NONE") return null;
    if (jobPhase === "TO_DROPOFF") return customer ?? dropoff ?? pickup;
    if (jobPhase === "TO_PICKUP") return pickup ?? customer ?? dropoff;
    return pickup ?? customer ?? dropoff;
  }, [customer, dropoff, jobPhase, pickup]);

  const activeDriverLocation = driverLocations[0]?.location;
  const activeRoute = routeOptions[activeRouteIndex] ?? null;
  const settings = navSettings ?? DEFAULT_SETTINGS;

  useEffect(() => {
    currentLocationRef.current = activeDriverLocation ?? null;
  }, [activeDriverLocation]);

  useEffect(() => {
    targetRef.current = targetLocation ?? null;
    if (!targetLocation) {
      setRouteOptions([]);
      setActiveRouteIndex(0);
      setGuidance(null);
      setTurnMarkers(null);
    }
  }, [targetLocation]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("getBattery" in navigator)) return;
    let mounted = true;
    let batteryManager: BatteryManager | null = null;
    let updateHandler: (() => void) | null = null;
    (navigator as Navigator & { getBattery?: () => Promise<BatteryManager> })
      .getBattery?.()
      .then((battery) => {
        if (!mounted) return;
        batteryManager = battery;
        const update = () => {
          batteryRef.current = {
            level: battery.level,
            charging: battery.charging,
          };
          setBatteryLevel(battery.level);
          setBatteryCharging(battery.charging);
        };
        updateHandler = update;
        update();
        battery.addEventListener("levelchange", update);
        battery.addEventListener("chargingchange", update);
      })
      .catch(() => null);
    return () => {
      mounted = false;
      if (batteryManager && updateHandler) {
        batteryManager.removeEventListener("levelchange", updateHandler);
        batteryManager.removeEventListener("chargingchange", updateHandler);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const updateVoices = () => {
      voicesRef.current = synth.getVoices();
    };
    updateVoices();
    synth.onvoiceschanged = updateVoices;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  const speak = (text: string) => {
    if (!settings.voiceEnabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settings.voiceLocale;
    utterance.volume = settings.voiceVolume;
    const voices = voicesRef.current || [];
    const preferred =
      voices.find((voice) => voice.lang === settings.voiceLocale) ||
      voices.find((voice) => voice.lang.startsWith(settings.voiceLocale.split("-")[0]));
    if (preferred) {
      utterance.voice = preferred;
    }
    synth.cancel();
    synth.speak(utterance);
  };

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/driver/navigation/settings");
        if (!res.ok) {
          if (mounted) setNavSettings(DEFAULT_SETTINGS);
          return;
        }
        const data = await res.json();
        if (mounted && data?.settings) {
          setNavSettings({
            voiceEnabled: Boolean(data.settings.voiceEnabled),
            voiceLocale: data.settings.voiceLocale || DEFAULT_SETTINGS.voiceLocale,
            voiceVolume:
              typeof data.settings.voiceVolume === "number"
                ? data.settings.voiceVolume
                : DEFAULT_SETTINGS.voiceVolume,
            detailLevel: data.settings.detailLevel || DEFAULT_SETTINGS.detailLevel,
          });
        }
      } catch (_error) {
        if (mounted) setNavSettings(DEFAULT_SETTINGS);
      }
    };
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const queueSettingsSave = (next: DriverNavigationSettings) => {
    if (settingsSaveTimeout.current) {
      window.clearTimeout(settingsSaveTimeout.current);
    }
    settingsSaveTimeout.current = window.setTimeout(async () => {
      setSettingsSaving(true);
      try {
        await fetch("/api/driver/navigation/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
      } catch (_error) {
        // ignore
      } finally {
        setSettingsSaving(false);
      }
    }, 400);
  };

  const updateSettings = (partial: Partial<DriverNavigationSettings>) => {
    setNavSettings((prev) => {
      const next = { ...(prev ?? DEFAULT_SETTINGS), ...partial };
      queueSettingsSave(next);
      return next;
    });
  };

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
        const now = Date.now();

        const nextLocation: OtwLocation = { lat, lng, label: "You" };
        setDriverLocations([
          {
            driverId,
            location: nextLocation,
            updatedAt,
            currentRequestId: requestId,
          },
        ]);

        setTrackingStatus("active");

        let nextSpeed = Number.isFinite(position.coords.speed)
          ? (position.coords.speed as number)
          : null;
        let nextHeading = Number.isFinite(position.coords.heading)
          ? (position.coords.heading as number)
          : null;

        if (nextSpeed == null || !Number.isFinite(nextSpeed)) {
          const last = lastPositionRef.current;
          if (last) {
            const deltaSeconds = Math.max(1, (now - last.at) / 1000);
            const distanceKm = haversineDistanceKm(
              { lat: last.lat, lng: last.lng },
              { lat, lng }
            );
            nextSpeed = Math.max(0, (distanceKm * 1000) / deltaSeconds);
          }
        }

        if (nextHeading == null || !Number.isFinite(nextHeading)) {
          const last = lastPositionRef.current;
          if (last) {
            nextHeading = computeBearing(
              { lat: last.lat, lng: last.lng },
              { lat, lng }
            );
          }
        }

        setSpeedMps(nextSpeed ?? null);
        setHeading(nextHeading ?? null);
        lastPositionRef.current = { lat, lng, at: now };

        const last = lastSentRef.current;
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

          const telemetryPayload: Record<string, unknown> = {
            lat,
            lng,
            speedMps: nextSpeed ?? undefined,
            heading: nextHeading ?? undefined,
            accuracy: position.coords.accuracy ?? undefined,
            altitude: position.coords.altitude ?? undefined,
            batteryLevel: batteryRef.current?.level,
            batteryCharging: batteryRef.current?.charging,
          };

          if (requestType === "legacy") {
            telemetryPayload.requestId = requestId ?? undefined;
          } else {
            telemetryPayload.deliveryRequestId = requestId ?? undefined;
          }

          const telemetryRes = await fetch("/api/driver/navigation/telemetry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(telemetryPayload),
          });
          if (!telemetryRes.ok) {
            const message = await telemetryRes.text().catch(() => "");
            throw new Error(
              `Telemetry failed with status ${telemetryRes.status}${message ? `: ${message}` : ""}`
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
        maximumAge: 2_000,
        timeout: 12_000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [driverId, requestId, requestType]);

  const refreshDriverRoute = async (reason?: "off-route" | "scheduled" | "manual") => {
    const origin = currentLocationRef.current;
    const destination = targetRef.current;
    if (!origin || !destination) return;
    if (rerouteInFlightRef.current) return;
    const now = Date.now();
    if (reason !== "off-route" && now - lastRouteRefreshRef.current < ROUTE_REFRESH_MS) {
      return;
    }
    lastRouteRefreshRef.current = now;
    rerouteInFlightRef.current = true;
    setRouteError(null);

    try {
      const params = new URLSearchParams({
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        alternatives: "2",
        lang: settings.voiceLocale,
      });
      const res = await fetch(`/api/navigation/route?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        throw new Error(`Navigation route failed: ${res.status}${message ? ` ${message}` : ""}`);
      }
      const data = await res.json();
      if (!data?.success || !data?.route) {
        throw new Error("Navigation route response was invalid.");
      }
      const nextRoutes = [data.route, ...(data.alternatives || [])];
      setRouteOptions(nextRoutes);
      setActiveRouteIndex((prev) => Math.min(prev, Math.max(0, nextRoutes.length - 1)));
      if (reason === "off-route") {
        speak("Re-routing to your destination.");
      }
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "Unable to fetch navigation route.");
    } finally {
      rerouteInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!activeDriverLocation || !targetLocation) return;
    refreshDriverRoute("manual");
  }, [activeDriverLocation, targetLocation, settings.voiceLocale]);

  useEffect(() => {
    if (!activeDriverLocation || !targetLocation) return;
    const interval = window.setInterval(() => {
      refreshDriverRoute("scheduled");
    }, ROUTE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [activeDriverLocation, targetLocation, settings.voiceLocale]);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setMainRoute(null);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const params = new URLSearchParams({
          origin: `${pickup.lat},${pickup.lng}`,
          destination: `${(customer ?? dropoff).lat},${(customer ?? dropoff).lng}`,
          alternatives: "0",
          lang: settings.voiceLocale,
        });
        const res = await fetch(`/api/navigation/route?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.route) {
          setMainRoute(data.route);
        }
      } catch (_error) {
        // ignore
      }
    };
    load();
    return () => controller.abort();
  }, [customer, dropoff, pickup, settings.voiceLocale]);

  useEffect(() => {
    if (!activeRoute || !activeDriverLocation) {
      setGuidance(null);
      setTurnMarkers(null);
      return;
    }
    const state = buildGuidanceState(activeRoute, [
      activeDriverLocation.lng,
      activeDriverLocation.lat,
    ]);
    setGuidance(state);
    const markers = buildTurnMarkers(activeRoute, state.nextManeuver, TURN_MARKER_DISTANCES);
    setTurnMarkers(markers.length ? buildTurnMarkerCollection(markers) : null);
  }, [activeDriverLocation, activeRoute]);

  useEffect(() => {
    if (!activeRoute) {
      setEtaSeconds(null);
      return;
    }
    const summary = activeRoute.summary || {};
    const duration =
      summary.duration ??
      summary.baseDuration ??
      summary.typicalDuration ??
      (summary.baseDuration && summary.trafficDelay
        ? summary.baseDuration + summary.trafficDelay
        : undefined);
    setEtaSeconds(duration ?? null);
  }, [activeRoute]);

  useEffect(() => {
    if (!guidance || !activeRoute) {
      setOffRoute(false);
      offRouteSinceRef.current = null;
      return;
    }
    const distanceFromRoute = guidance.distanceFromRouteMeters;
    if (distanceFromRoute > OFF_ROUTE_THRESHOLD_METERS) {
      if (!offRouteSinceRef.current) {
        offRouteSinceRef.current = Date.now();
      }
      const elapsed = Date.now() - offRouteSinceRef.current;
      if (elapsed >= OFF_ROUTE_GRACE_MS) {
        setOffRoute(true);
        if (Date.now() - lastRerouteAtRef.current > OFF_ROUTE_GRACE_MS) {
          lastRerouteAtRef.current = Date.now();
          refreshDriverRoute("off-route");
        }
      }
    } else {
      setOffRoute(false);
      offRouteSinceRef.current = null;
    }
  }, [guidance, activeRoute]);

  useEffect(() => {
    if (!guidance?.nextManeuver || guidance.distanceToNextMeters == null) return;
    if (!settings.voiceEnabled) return;

    const maneuverId = guidance.nextManeuver.id;
    if (maneuverId !== lastManeuverIdRef.current) {
      spokenRef.current.clear();
      lastManeuverIdRef.current = maneuverId;
      lastDistanceRef.current = guidance.distanceToNextMeters;
    }

    const previousDistance = lastDistanceRef.current;
    const currentDistance = guidance.distanceToNextMeters;
    lastDistanceRef.current = currentDistance;
    if (previousDistance == null) return;

    const speed = speedMps ?? 13;
    const earlyDistance = Math.max(150, Math.min(600, speed * 8));
    const nearDistance = Math.max(40, Math.min(200, speed * 3));

    const baseThresholds =
      settings.detailLevel === "compact"
        ? [nearDistance]
        : [earlyDistance, ...TURN_MARKER_DISTANCES, nearDistance];
    const thresholds = Array.from(new Set(baseThresholds.map((value) => Math.round(value))));

    thresholds.forEach((threshold) => {
      if (previousDistance > threshold && currentDistance <= threshold) {
        const key = `${maneuverId}:${threshold}`;
        if (spokenRef.current.has(key)) return;
        spokenRef.current.add(key);
        const prefix =
          threshold <= nearDistance || currentDistance <= 20
            ? "Now"
            : `In ${formatDistanceSpeech(threshold, settings.voiceLocale)}`;
        const instruction = buildInstructionText(guidance.nextManeuver, settings.detailLevel);
        speak(`${prefix}, ${instruction}`.trim());
      }
    });
  }, [guidance, settings.detailLevel, settings.voiceEnabled, settings.voiceLocale, speedMps]);

  useEffect(() => {
    if (!activeRoute && !activeDriverLocation) return;

    const refreshTraffic = async () => {
      const routeBounds = activeRoute?.bounds;
      const origin = activeDriverLocation ?? currentLocationRef.current;
      if (!routeBounds && !origin) return;

      const padding = 0.02;
      const minLat = (routeBounds?.minLat ?? origin!.lat) - padding;
      const maxLat = (routeBounds?.maxLat ?? origin!.lat) + padding;
      const minLng = (routeBounds?.minLng ?? origin!.lng) - padding;
      const maxLng = (routeBounds?.maxLng ?? origin!.lng) + padding;
      const bbox = `${maxLat},${minLng};${minLat},${maxLng}`;

      try {
        const [flowRes, incidentRes] = await Promise.all([
          fetch(`/api/navigation/traffic?bbox=${encodeURIComponent(bbox)}`, { cache: "no-store" }),
          fetch(`/api/navigation/incidents?bbox=${encodeURIComponent(bbox)}`, { cache: "no-store" }),
        ]);
        if (flowRes.ok) {
          const flowData = await flowRes.json();
          setTrafficFlow(flowData?.flow ?? null);
        }
        if (incidentRes.ok) {
          const incidentData = await incidentRes.json();
          setIncidents(incidentData?.incidents ?? null);
        }
      } catch (_error) {
        // ignore
      }
    };

    refreshTraffic();
    const interval = window.setInterval(refreshTraffic, TRAFFIC_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [activeDriverLocation, activeRoute]);

  useEffect(() => {
    const origin = activeDriverLocation ?? currentLocationRef.current;
    if (!origin) return;
    const now = Date.now();
    if (now - (lastPoiFetchRef.current?.at ?? 0) < POI_REFRESH_MS) {
      const last = lastPoiFetchRef.current;
      if (last) {
        const distanceKm = haversineDistanceKm(
          { lat: last.lat, lng: last.lng },
          { lat: origin.lat, lng: origin.lng }
        );
        if (distanceKm < 2) return;
      }
    }

    const refreshPois = async () => {
      try {
        const at = `${origin.lat},${origin.lng}`;
        const [fuelRes, restRes] = await Promise.all([
          fetch(`/api/navigation/pois?at=${encodeURIComponent(at)}&query=fuel station`, {
            cache: "no-store",
          }),
          fetch(`/api/navigation/pois?at=${encodeURIComponent(at)}&query=rest area`, {
            cache: "no-store",
          }),
        ]);
        const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
        const addItems = (items: Array<any>) => {
          items.forEach((item) => {
            if (!item?.position) return;
            const { lat, lng } = item.position;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            features.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: [lng, lat] },
              properties: {
                title: item.title,
                address: item.address,
                categories: item.categories || [],
                distance: item.distance,
              },
            });
          });
        };
        if (fuelRes.ok) {
          const data = await fuelRes.json();
          addItems(data?.items || []);
        }
        if (restRes.ok) {
          const data = await restRes.json();
          addItems(data?.items || []);
        }
        setPois(features.length ? { type: "FeatureCollection", features } : null);
        lastPoiFetchRef.current = { lat: origin.lat, lng: origin.lng, at: Date.now() };
      } catch (_error) {
        // ignore
      }
    };

    refreshPois();
  }, [activeDriverLocation]);

  useEffect(() => {
    const origin = activeDriverLocation ?? currentLocationRef.current;
    if (!origin) return;
    const now = Date.now();
    if (now - lastWeatherFetchRef.current < WEATHER_REFRESH_MS) return;
    lastWeatherFetchRef.current = now;

    const refreshWeather = async () => {
      try {
        const res = await fetch(
          `/api/navigation/weather?lat=${origin.lat}&lng=${origin.lng}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        setWeather(data?.weather ?? null);
      } catch (_error) {
        // ignore
      }
    };

    refreshWeather();
  }, [activeDriverLocation]);

  const nextInstruction = useMemo(() => {
    return buildInstructionText(guidance?.nextManeuver, settings.detailLevel);
  }, [guidance?.nextManeuver, settings.detailLevel]);

  const distanceToNext = guidance?.distanceToNextMeters;
  const remainingDistanceMeters = useMemo(() => {
    if (!guidance?.cumulativeDistances?.length) return null;
    const total = guidance.cumulativeDistances[guidance.cumulativeDistances.length - 1];
    const current = guidance.cumulativeDistances[guidance.currentIndex] ?? 0;
    return Math.max(0, total - current);
  }, [guidance]);

  const useMiles = settings.voiceLocale.toLowerCase().endsWith("us") || settings.voiceLocale.toLowerCase().startsWith("en");
  const speedLimit = guidance?.speedLimit;
  const speedLimitMps =
    speedLimit && typeof speedLimit.value === "number"
      ? speedLimit.unit?.toLowerCase().includes("mph")
        ? speedLimit.value / 2.23694
        : speedLimit.value / 3.6
      : null;
  const overspeed =
    speedLimitMps != null && speedMps != null && speedMps > speedLimitMps + 1.5;
  const speedLimitLabel = (() => {
    if (!speedLimit || typeof speedLimit.value !== "number") return "—";
    const rawUnit = speedLimit.unit?.toLowerCase() || "";
    if (useMiles) {
      const mph = rawUnit.includes("kph") ? speedLimit.value / 1.60934 : speedLimit.value;
      return `${Math.round(mph)} mph`;
    }
    const kph = rawUnit.includes("mph") ? speedLimit.value * 1.60934 : speedLimit.value;
    return `${Math.round(kph)} km/h`;
  })();

  const laneGuidance = useMemo(() => {
    const lanes = guidance?.nextManeuver?.lanes;
    if (!lanes?.length) return null;
    const laneDirections = lanes
      .map((lane) => (lane.directions || []).join("/"))
      .filter(Boolean);
    const validIndexes = lanes
      .map((lane, idx) => (lane.valid ? idx + 1 : null))
      .filter((value): value is number => value != null);
    const laneText = validIndexes.length
      ? `Use lanes ${validIndexes.join(", ")}`
      : "Lane guidance available";
    const directionText = laneDirections.length ? ` (${laneDirections.join(" • ")})` : "";
    return `${laneText}${directionText}`;
  }, [guidance?.nextManeuver?.lanes]);

  const driverRouteSummary: RouteSummary | null = useMemo(() => {
    if (!activeRoute) return null;
    return {
      distanceText: formatDistance(activeRoute.summary?.length, settings.voiceLocale),
      durationText: formatDuration(activeRoute.summary?.duration),
    };
  }, [activeRoute, settings.voiceLocale]);

  const mainRouteSummary: RouteSummary | null = useMemo(() => {
    if (!mainRoute) return null;
    return {
      distanceText: formatDistance(mainRoute.summary?.length, settings.voiceLocale),
      durationText: formatDuration(mainRoute.summary?.duration),
    };
  }, [mainRoute, settings.voiceLocale]);

  const trafficDelayLabel = formatDuration(activeRoute?.summary?.trafficDelay);
  const typicalDurationLabel = formatDuration(activeRoute?.summary?.typicalDuration);
  const lastSentLabel = formatTime(lastSentAt);

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
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Next maneuver</div>
          <div className="mt-2 text-lg font-semibold text-foreground">{nextInstruction}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {distanceToNext != null ? `${formatDistance(distanceToNext, settings.voiceLocale)} • ` : ""}
            ETA {etaSeconds != null ? formatDuration(etaSeconds) : "—"}
          </div>
          {laneGuidance && <div className="mt-2 text-xs text-muted-foreground">{laneGuidance}</div>}
          {offRoute && (
            <div className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200">
              Off route. Recalculating...
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Speed & limits</div>
          <div className={`mt-2 text-lg font-semibold ${overspeed ? "text-red-400" : "text-foreground"}`}>
            {formatSpeed(speedMps ?? undefined, settings.voiceLocale)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Speed limit {speedLimitLabel}
          </div>
          {heading != null && (
            <div className="mt-1 text-xs text-muted-foreground">Heading {Math.round(heading)}°</div>
          )}
          {batteryLevel != null && (
            <div className="mt-1 text-xs text-muted-foreground">
              Battery {Math.round(batteryLevel * 100)}%{batteryCharging ? " (charging)" : ""}
            </div>
          )}
          {batteryLevel == null && (
            <div className="mt-1 text-xs text-muted-foreground">
              Vehicle telemetry not connected.
            </div>
          )}
          {overspeed && (
            <div className="mt-2 text-xs text-red-300">Slow down to stay within the limit.</div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            Remaining {remainingDistanceMeters != null ? formatDistance(remainingDistanceMeters, settings.voiceLocale) : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Conditions</div>
          <div className="mt-2 text-sm text-foreground">
            {weather?.description || weather?.precipitationDesc || "Weather data pending"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {typeof weather?.temperature === "number" ? `${Math.round(weather.temperature)}°` : "—"} · Visibility{" "}
            {typeof weather?.visibility === "number" ? `${Math.round(weather.visibility)} m` : "—"}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Traffic delay {trafficDelayLabel} · Typical {typicalDurationLabel}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Incidents {incidents?.features?.length ?? 0} · POIs {pois?.features?.length ?? 0}
          </div>
        </div>
      </div>

      <OtwLiveMap
        customer={customer}
        pickup={pickup}
        dropoff={dropoff}
        requestId={requestId}
        jobStatus={jobStatus}
        focusDriverId={driverId}
        drivers={driverLocations}
        useExternalRoutes
        mainRouteOverride={mainRoute?.geometry ?? null}
        mainRouteSummaryOverride={mainRouteSummary}
        driverRouteOverride={activeRoute?.geometry ?? null}
        driverRouteSummaryOverride={driverRouteSummary}
        turnMarkers={turnMarkers}
        trafficFlow={trafficFlow}
        incidents={incidents}
        pois={pois}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Alternative routes
          </div>
          <div className="mt-2 space-y-2">
            {routeOptions.length === 0 && (
              <div className="text-xs text-muted-foreground">
                {routeError || "Waiting for route data..."}
              </div>
            )}
            {routeOptions.map((route, index) => {
              const active = index === activeRouteIndex;
              return (
                <button
                  key={`route-${index}`}
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    active
                      ? "border-otwGold bg-otwGold/10 text-otwGold"
                      : "border-border/70 bg-card/60 text-foreground hover:border-otwGold/60"
                  }`}
                  onClick={() => setActiveRouteIndex(index)}
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em]">
                    <span>Route {index + 1}</span>
                    {active && <span>Active</span>}
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatDistance(route.summary?.length, settings.voiceLocale)} ·{" "}
                    {formatDuration(route.summary?.duration)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Traffic {formatDuration(route.summary?.trafficDelay)} · Energy unavailable
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Navigation settings
            </span>
            {settingsSaving && <span className="text-xs text-muted-foreground">Saving…</span>}
          </div>
          <div className="mt-3 space-y-3">
            <label className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Voice guidance</span>
              <input
                type="checkbox"
                checked={settings.voiceEnabled}
                onChange={(event) => updateSettings({ voiceEnabled: event.target.checked })}
                className="h-4 w-4 accent-otwGold"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Language</span>
              <select
                value={settings.voiceLocale}
                onChange={(event) =>
                  updateSettings({ voiceLocale: event.target.value as DriverNavigationSettings["voiceLocale"] })
                }
                className="rounded-md border border-border/70 bg-card/60 px-2 py-1 text-xs text-foreground"
              >
                <option value="en-US">English (US)</option>
                <option value="es-US">Español (US)</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Detail level</span>
              <select
                value={settings.detailLevel}
                onChange={(event) =>
                  updateSettings({ detailLevel: event.target.value as DriverNavigationSettings["detailLevel"] })
                }
                className="rounded-md border border-border/70 bg-card/60 px-2 py-1 text-xs text-foreground"
              >
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Voice volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.voiceVolume}
                onChange={(event) =>
                  updateSettings({ voiceVolume: Number(event.target.value) })
                }
                className="w-32"
              />
            </label>
          </div>
        </div>
      </div>

      <div
        className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground/80">Location status:</span>
          <span>{statusCopy}</span>
          {lastSentLabel && (
            <span className="text-muted-foreground">Last sent {lastSentLabel}.</span>
          )}
        </div>
        {locationError && <div className="mt-1 text-red-400">{locationError}</div>}
        {syncError && <div className="mt-1 text-amber-300">{syncError}</div>}
      </div>
    </div>
  );
};

export default DriverLiveMap;
