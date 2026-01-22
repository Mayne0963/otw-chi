"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createVoiceQueue, VOICE_GUIDANCE_STORAGE_KEY } from "@/lib/navigation/voiceQueue";
import { getClientEnvDiagnostics } from "@/lib/envDiagnostics";

// --- HERE Maps Type Definitions ---
interface HGeoPoint {
  lat: number;
  lng: number;
}

interface HMapObject {
  setGeometry(geometry: HGeoPoint): void;
  setVisibility(opt_visibility: boolean): void;
  dispose(): void;
}

interface HMarker extends HMapObject {
  setStyle(style: { fillColor: string; lineWidth: number }): void;
  setData(data: string): void;
}

interface HCircle extends HMapObject {
  setStyle(style: { strokeColor: string; lineWidth: number; fillColor: string }): void;
}

interface HPolyline extends HMapObject {
  getBoundingBox(): HBoundingBox;
}

interface HBoundingBox {
  getBoundingBox?(): unknown;
}

interface HMap {
  addObject(object: unknown): void;
  removeObject(object: unknown): void;
  setZoom(zoom: number, animate?: boolean): void;
  setCenter(center: HGeoPoint, animate?: boolean): void;
  getViewPort(): { resize(): void };
  getViewModel(): { setLookAtData(data: { bounds: unknown }): void };
  dispose(): void;
}

interface HPlatform {
  createDefaultLayers(): { vector: { normal: { map: unknown } } };
}

interface HBehavior {
  disable(): void;
}

interface HUI {
  getControls(): unknown[];
  removeControl(control: unknown): void;
}

// Global H object on window
interface WindowWithH extends Window {
  H: {
    service: {
      Platform: new (options: { apikey: string }) => HPlatform;
    };
    Map: new (element: HTMLElement, mapLayer: unknown, options: unknown) => HMap;
    mapevents: {
      Behavior: new (events: unknown) => HBehavior;
      MapEvents: new (map: HMap) => unknown;
    };
    ui: {
      UI: {
        createDefault: (map: HMap, layers: unknown) => HUI;
      };
    };
    map: {
      Marker: new (coords: HGeoPoint, options?: unknown) => HMarker;
      Circle: new (coords: HGeoPoint, radius: number, options?: unknown) => HCircle;
      Icon: new (svg: string) => unknown;
      Polyline: new (strip: unknown, options?: unknown) => HPolyline;
    };
    geo: {
      LineString: new () => { pushPoint(coords: HGeoPoint): void };
    };
  };
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type LatLng = { lat: number; lng: number };
type Stop = LatLng & { id: string; label?: string; type?: "pickup" | "dropoff" };
type RouteResponse = {
  coordinates: Array<{ lat: number; lng: number }> | null;
  polyline: string | null;
  distanceMeters: number;
  durationSeconds: number;
};

interface ApiStopRaw {
  id?: string;
  label?: string;
  type?: "pickup" | "dropoff";
  lat?: number;
  lng?: number;
}

const DEMO_STOPS: Stop[] = [
  { id: "pickup-1", label: "Pickup - The Hoppy Gnome", type: "pickup", lat: 41.0793, lng: -85.1394 },
  { id: "drop-1", label: "Dropoff - Parkview Field", type: "dropoff", lat: 41.0799, lng: -85.1527 },
];

const haversineMeters = (a: LatLng, b: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

type MapRefs = {
  platform: HPlatform | null;
  map: HMap | null;
  behavior: HBehavior | null;
  ui: HUI | null;
  driverMarker: HCircle | null;
  stopMarkers: Record<string, HMarker>;
  routePolyline: HPolyline | null;
};

const hereKey = process.env.NEXT_PUBLIC_HERE_MAPS_KEY;

const DriverMapClient = () => {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRefs = useRef<MapRefs>({
    platform: null,
    map: null,
    behavior: null,
    ui: null,
    driverMarker: null,
    stopMarkers: {},
    routePolyline: null,
  });
  const watchIdRef = useRef<number | null>(null);
  const lastRerouteAtRef = useRef<number>(0);
  const movingAwayTicksRef = useRef<number>(0);
  const finalApproachRef = useRef<boolean>(false);
  const finalApproachStartedAtRef = useRef<number | null>(null);
  const voiceQueueRef = useRef<ReturnType<typeof createVoiceQueue> | null>(null);
  const mapCleanupRef = useRef<(() => void) | null>(null);
  const lastDistanceRef = useRef<number | null>(null);

  const [demoMode, setDemoMode] = useState(true);
  const [stops, setStops] = useState<Stop[]>(DEMO_STOPS);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [jobStarted, setJobStarted] = useState(false);
  const [trafficRisk] = useState<"LOW" | "MED" | "HIGH">("LOW");
  const [mapReady, setMapReady] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const activeStop = stops[activeStopIndex];

  // Removed unused stopList useMemo since stops is already state

  const shouldUseVoiceGuidance = useCallback(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(VOICE_GUIDANCE_STORAGE_KEY);
    if (stored === "false") return false;
    return true;
  }, []);

  const resetMapRefs = useCallback(() => {
    mapRefs.current = {
      platform: null,
      map: null,
      behavior: null,
      ui: null,
      driverMarker: null,
      stopMarkers: {},
      routePolyline: null,
    };
  }, []);

  const hasContainerSize = useCallback(() => {
    const el = mapContainerRef.current;
    if (!el) return false;
    const { width, height } = el.getBoundingClientRect();
    return width > 40 && height > 40;
  }, []);

  const speakNavigationPrime = useCallback(() => {
    const queue = voiceQueueRef.current;
    if (!queue || !shouldUseVoiceGuidance()) return;
    const lang =
      typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    queue.setDefaults({ lang, volume: 0.75 });
    queue.setEnabled(true);
    queue.unlock();
    queue.enqueue({ text: "Navigation started.", lang, volume: 0.75, flush: true });
  }, [shouldUseVoiceGuidance]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const queue = createVoiceQueue();
    voiceQueueRef.current = queue;
    const lang = navigator.language || "en-US";
    queue.setDefaults({ lang, volume: 0.75 });
    const stored = window.localStorage.getItem(VOICE_GUIDANCE_STORAGE_KEY);
    queue.setEnabled(stored === "false" ? false : true);
    return () => queue.cancel();
  }, []);

  const ensureHereScripts = useCallback(async () => {
    if (typeof window === "undefined") return;
    if ((window as unknown as WindowWithH).H) return;
    const scripts = [
      "https://js.api.here.com/v3/3.1/mapsjs-core.js",
      "https://js.api.here.com/v3/3.1/mapsjs-service.js",
      "https://js.api.here.com/v3/3.1/mapsjs-ui.js",
      "https://js.api.here.com/v3/3.1/mapsjs-mapevents.js",
    ];
    await Promise.all(
      scripts.map(
        (src) =>
          new Promise<void>((resolve, reject) => {
            const tag = document.createElement("script");
            tag.src = src;
            tag.async = true;
            tag.onload = () => resolve();
            tag.onerror = (err) => reject(err);
            document.body.appendChild(tag);
          })
      )
    );
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://js.api.here.com/v3/3.1/mapsjs-ui.css";
    document.head.appendChild(link);
  }, []);

  const initMap = useCallback(async () => {
    if (mapRefs.current.map || mapReady) return;
    if (!hasContainerSize()) return;
    const { missing } = getClientEnvDiagnostics(["NEXT_PUBLIC_HERE_MAPS_KEY"]);
    if (!hereKey || missing.includes("NEXT_PUBLIC_HERE_MAPS_KEY")) {
      setMapError("Missing NEXT_PUBLIC_HERE_MAPS_KEY in Vercel");
      return;
    }
    if (!mapContainerRef.current) return;
    try {
      await ensureHereScripts();
    } catch (_error) {
      setMapError("Failed to load map libraries.");
      return;
    }
    const H = (window as unknown as WindowWithH).H;
    if (!H) {
      setMapError("HERE Maps is unavailable in this browser.");
      return;
    }
    try {
      const platform = new H.service.Platform({
        apikey: hereKey,
      });
      const layers = platform.createDefaultLayers();
      const map = new H.Map(mapContainerRef.current, layers.vector.normal.map, {
        zoom: 13,
        center: { lat: 41.0793, lng: -85.1394 },
        pixelRatio: window.devicePixelRatio || 1,
      });
      const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
      const ui = H.ui.UI.createDefault(map, layers);
      ui.getControls().forEach((control: unknown) => ui.removeControl(control));
      mapRefs.current = {
        platform,
        map,
        behavior,
        ui,
        driverMarker: null,
        stopMarkers: {},
        routePolyline: null,
      };
      const resizeHandler = () => map.getViewPort().resize();
      window.addEventListener("resize", resizeHandler);
      mapCleanupRef.current = () => {
        window.removeEventListener("resize", resizeHandler);
        if (mapRefs.current.map) {
          map.dispose();
        }
        resetMapRefs();
      };
      setMapError(null);
      setMapReady(true);
    } catch (error) {
      console.error("Map init failed", error);
      setMapError("Map failed to initialize.");
    }
  }, [mapReady, hasContainerSize, ensureHereScripts, resetMapRefs]);

  const updateDriverMarker = useCallback((location: LatLng) => {
    const H = (window as unknown as WindowWithH).H;
    const { map } = mapRefs.current;
    if (!H || !map) return;
    if (mapRefs.current.driverMarker) {
      mapRefs.current.driverMarker.setGeometry(location);
      return;
    }
    const dot = new H.map.Circle(location, 10, {
      style: {
        strokeColor: "rgba(14, 165, 233, 0.28)",
        lineWidth: 2,
        fillColor: "rgba(14, 165, 233, 0.9)",
      },
    });
    map.addObject(dot);
    mapRefs.current.driverMarker = dot;
  }, []);

  const updateStopMarkers = useCallback(() => {
    const H = (window as unknown as WindowWithH).H;
    const { map, stopMarkers } = mapRefs.current;
    if (!H || !map) return;
    stops.forEach((stop, idx) => {
      const existing = stopMarkers[stop.id];
      const isActive = idx === activeStopIndex;
      if (existing) {
        existing.setGeometry(stop);
        existing.setStyle({ fillColor: isActive ? "#eab308" : "#0ea5e9", lineWidth: 2 });
        return;
      }
      const marker = new H.map.Marker(stop, {
        icon: new H.map.Icon(
          `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="7" fill="${isActive ? "#eab308" : "#0ea5e9"}" />
          </svg>`
        ),
      });
      marker.setData(stop.label || stop.id);
      map.addObject(marker);
      stopMarkers[stop.id] = marker;
    });
  }, [stops, activeStopIndex]);

  const drawRoute = useCallback((coordinates: Array<{ lat: number; lng: number }> | null) => {
    const H = (window as unknown as WindowWithH).H;
    const { map } = mapRefs.current;
    if (!H || !map) return;
    if (mapRefs.current.routePolyline) {
      map.removeObject(mapRefs.current.routePolyline);
      mapRefs.current.routePolyline = null;
    }
    if (!coordinates || !coordinates.length) return;
    const lineString = new H.geo.LineString();
    coordinates.forEach((coord) => lineString.pushPoint(coord));
    const polyline = new H.map.Polyline(lineString, {
      style: { strokeColor: "#0ea5e9", lineWidth: 8, lineJoin: "round", lineCap: "round" },
    });
    map.addObject(polyline);
    mapRefs.current.routePolyline = polyline;
    const bbox = polyline.getBoundingBox();
    map.getViewModel().setLookAtData({
      bounds: bbox.getBoundingBox ? bbox.getBoundingBox() : bbox,
    });
  }, []);

  const computeRoute = useCallback(async (origin: LatLng, remainingStops: Stop[]) => {
    if (!remainingStops.length) return null;
    setLoadingRoute(true);
    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          stops: remainingStops.map((s) => ({ lat: s.lat, lng: s.lng, type: s.type || "dropoff" })),
          mode: "car",
        }),
      });
      if (!response.ok) throw new Error("Route request failed");
      const data: RouteResponse = await response.json();
      setRoute(data);
      if (data.durationSeconds) setEtaMinutes(Math.max(1, Math.round(data.durationSeconds / 60)));
      if (data.distanceMeters) setDistanceMiles(Number((data.distanceMeters / 1609.34).toFixed(1)));
      drawRoute(data.coordinates);
      return data;
    } finally {
      setLoadingRoute(false);
    }
  }, [drawRoute]);

  const startJob = useCallback(async () => {
    if (!driverLocation || !activeStop) return;
    if (stops.some((s) => typeof s.lat !== "number" || typeof s.lng !== "number")) {
      setJobError("Stops missing coordinates; cannot start routing.");
      return;
    }
    setJobStarted(true);
    speakNavigationPrime();
    finalApproachRef.current = false;
    finalApproachStartedAtRef.current = null;
    await computeRoute(driverLocation, stops.slice(activeStopIndex));
    lastRerouteAtRef.current = Date.now();
  }, [driverLocation, activeStop, stops, activeStopIndex, speakNavigationPrime, computeRoute]);

  const advanceStop = useCallback(async () => {
    const nextIndex = activeStopIndex + 1;
    if (nextIndex >= stops.length) {
      setActiveStopIndex(nextIndex);
      setRoute(null);
      setJobStarted(false);
      return;
    }
    setActiveStopIndex(nextIndex);
    finalApproachRef.current = false;
    finalApproachStartedAtRef.current = null;
    if (driverLocation) {
      await computeRoute(driverLocation, stops.slice(nextIndex));
      lastRerouteAtRef.current = Date.now();
    }
  }, [activeStopIndex, stops, driverLocation, computeRoute]);

  const manualReroute = useCallback(async () => {
    if (!driverLocation || !jobStarted) return;
    await computeRoute(driverLocation, stops.slice(activeStopIndex));
    lastRerouteAtRef.current = Date.now();
  }, [driverLocation, jobStarted, stops, activeStopIndex, computeRoute]);

  const handleLocation = useCallback(async (coords: LatLng) => {
    setDriverLocation(coords);
    updateDriverMarker(coords);
    if (!jobStarted || !activeStop) return;
    const distanceToActive = haversineMeters(coords, activeStop);
    if (distanceToActive < 90) {
      if (!finalApproachRef.current) {
        finalApproachRef.current = true;
        finalApproachStartedAtRef.current = Date.now();
        if (mapRefs.current.map) {
          mapRefs.current.map.setZoom(17, true);
          mapRefs.current.map.setCenter(activeStop, true);
        }
      }
      return;
    }

    if (finalApproachRef.current) {
      const started = finalApproachStartedAtRef.current ?? Date.now();
      if (Date.now() - started < 10_000) return;
    }

    const routeDistance = route?.distanceMeters ?? null;
    const lastDistance = lastDistanceRef.current;
    lastDistanceRef.current = distanceToActive;

    const movingAway = lastDistance != null && distanceToActive > lastDistance + 8;
    if (movingAway) {
      movingAwayTicksRef.current += 1;
    } else {
      movingAwayTicksRef.current = Math.max(0, movingAwayTicksRef.current - 1);
    }

    const shouldReroute =
      Date.now() - lastRerouteAtRef.current > 30_000 &&
      movingAwayTicksRef.current >= 3 &&
      distanceToActive > 50 &&
      routeDistance !== null &&
      !finalApproachRef.current;

    if (shouldReroute) {
      await computeRoute(coords, stops.slice(activeStopIndex));
      lastRerouteAtRef.current = Date.now();
      movingAwayTicksRef.current = 0;
    }
  }, [jobStarted, activeStop, route?.distanceMeters, stops, activeStopIndex, computeRoute, updateDriverMarker]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let pollId: number | null = null;

    const attemptInit = () => {
      if (cancelled) return;
      if (!mapRefs.current.map && hasContainerSize()) {
        initMap();
      }
    };

    attemptInit();

    if (typeof ResizeObserver !== "undefined" && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => attemptInit());
      resizeObserver.observe(mapContainerRef.current);
    } else if (typeof window !== "undefined") {
      pollId = window.setInterval(attemptInit, 500);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (pollId) {
        window.clearInterval(pollId);
      }
      mapCleanupRef.current?.();
      if (watchIdRef.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [hasContainerSize, initMap]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration failed", err));
    }
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    updateStopMarkers();
  }, [mapReady, updateStopMarkers]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        handleLocation(coords);
      },
      (err) => {
        console.error("Geolocation error", err);
      },
      { enableHighAccuracy: true, maximumAge: 1_000, timeout: 10_000 }
    );
    return () => {
      if (watchIdRef.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [handleLocation]);

  useEffect(() => {
    if (demoMode && !jobId) {
      setStops(DEMO_STOPS);
      setActiveStopIndex(0);
      setJobStarted(false);
      setRoute(null);
      setJobError(null);
    }
  }, [demoMode, jobId]);

  useEffect(() => {
    if (!jobId) return;
    const load = async () => {
      setJobLoading(true);
      setJobError(null);
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) {
          const msg = await res.text().catch(() => "Unable to load job");
          throw new Error(msg || "Unable to load job");
        }
        const data = (await res.json()) as { stops?: ApiStopRaw[] };
        const nextStops: Stop[] = (data.stops || [])
          .filter((s) => s?.id)
          .map((s) => ({
            id: s.id!,
            label: s.label || s.type,
            type: s.type,
            lat: typeof s.lat === "number" ? s.lat : NaN,
            lng: typeof s.lng === "number" ? s.lng : NaN,
          }));
        if (!nextStops.length) {
          throw new Error("Job has no stops");
        }
        setStops(nextStops);
        setActiveStopIndex(0);
        setJobStarted(false);
        setRoute(null);
        setDemoMode(false);
        if (nextStops.some((s) => Number.isNaN(s.lat) || Number.isNaN(s.lng))) {
          setJobError("This job is missing coordinates; routing may be unavailable.");
        }
      } catch (error) {
        setJobError(error instanceof Error ? error.message : "Unable to load job");
      } finally {
        setJobLoading(false);
      }
    };
    load();
  }, [jobId]);

  useEffect(() => {
    if (jobId && !jobError && !jobLoading && driverLocation && stops.length && !jobStarted) {
      startJob().catch(() => null);
    }
  }, [jobId, jobError, jobLoading, driverLocation, stops.length, jobStarted, startJob]);

  const nextStopLabel = activeStop?.label || (activeStop?.type === "pickup" ? "Pickup" : "Dropoff");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <header className="sticky top-4 z-20 rounded-2xl border border-border/70 bg-muted/60 backdrop-blur px-4 py-3 shadow-otwSoft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">ETA</div>
              <div className="text-xl font-semibold">{etaMinutes != null ? `${etaMinutes} min` : "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Distance</div>
              <div className="text-xl font-semibold">
                {distanceMiles != null ? `${distanceMiles} mi` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Next Stop</div>
              <div className="text-xl font-semibold">{nextStopLabel || "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={cn(
                "border-border/70 px-3 py-1 text-xs uppercase tracking-[0.18em]",
                trafficRisk === "HIGH" && "border-red-400 text-red-200",
                trafficRisk === "MED" && "border-amber-300 text-amber-200",
                trafficRisk === "LOW" && "border-emerald-300 text-emerald-200"
              )}
            >
              Traffic: {trafficRisk}
            </Badge>
            {installPrompt && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  installPrompt.prompt();
                  installPrompt.userChoice.finally(() => setInstallPrompt(null));
                }}
              >
                Install OTW
              </Button>
            )}
            {!jobId && (
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-xs">
                <span>Demo Mode</span>
                <button
                  type="button"
                  onClick={() => setDemoMode((prev) => !prev)}
                  className={cn(
                    "flex h-6 items-center rounded-full px-1 transition-colors",
                    demoMode ? "bg-secondary/80" : "bg-muted"
                  )}
                  aria-label="Toggle demo stops"
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full bg-background shadow transition-transform",
                      demoMode ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 lg:flex-row">
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-border/70 bg-muted/40 shadow-otwSoft">
          <div
            ref={mapContainerRef}
            className="absolute inset-0 min-h-[60vh] rounded-2xl sm:min-h-[520px] lg:min-h-[640px]"
            aria-label="Driver map"
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-background/10 via-background/5 to-background/10" />
          {!mapReady && !mapError && (
            <div className="absolute inset-0 flex min-h-[60vh] items-center justify-center sm:min-h-[520px] lg:min-h-[640px]">
              <div className="rounded-lg border border-border/60 bg-card/70 px-4 py-3 text-sm text-muted-foreground shadow-otwSoft">
                Loading map…
              </div>
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 flex min-h-[60vh] items-center justify-center bg-background/80 sm:min-h-[520px] lg:min-h-[640px]">
              <div className="max-w-md space-y-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-otwSoft">
                <div className="font-semibold text-red-200">Map unavailable</div>
                <div>{mapError}</div>
              </div>
            </div>
          )}
          <div className="min-h-[60vh] sm:min-h-[520px] lg:min-h-[640px]" />
        </div>
        <div className="w-full max-w-md space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-otwSoft">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Delivery-only driver view · HERE Maps
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={startJob} disabled={loadingRoute || !driverLocation} className="w-full">
              {loadingRoute ? "Starting..." : "Start Job"}
            </Button>
            <Button variant="secondary" onClick={advanceStop} disabled={!jobStarted} className="w-full">
              Arrived
            </Button>
            <Button variant="outline" onClick={manualReroute} disabled={!jobStarted} className="col-span-2">
              Re-route
            </Button>
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stops</div>
            <div className="space-y-1">
              {stops.map((stop, idx) => {
                const isActive = idx === activeStopIndex;
                return (
                  <div
                    key={stop.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                      isActive
                        ? "border-amber-400/30 bg-amber-400/10"
                        : "border-transparent bg-background/50 hover:bg-background/80"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        isActive ? "bg-amber-400 text-amber-950" : "bg-sky-500/20 text-sky-400"
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("truncate text-sm font-medium", isActive && "text-amber-200")}>
                        {stop.label || stop.id}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">{stop.type}</div>
                    </div>
                  </div>
                );
              })}
              {stops.length === 0 && (
                <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  Add stops to start routing.
                </div>
              )}
              {jobError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {jobError}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
            Final approach mode triggers within 90m; auto-reroute no more than every 30s and only when moving away.
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverMapClient;
