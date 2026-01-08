"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import styles from "./OtwLiveMap.module.css";
import type { OtwLocation } from "@/lib/otw/otwTypes";
import type { OtwDriverLocation } from "@/lib/otw/otwDriverLocation";

interface OtwLiveMapProps {
  pickup?: OtwLocation;
  dropoff?: OtwLocation;
  customer?: OtwLocation;
  requestId?: string;
  jobStatus?: string;
  focusDriverId?: string;
  drivers?: OtwDriverLocation[];
  useExternalRoutes?: boolean;
  mainRouteOverride?: RouteFeature | null;
  mainRouteSummaryOverride?: RouteSummary | null;
  driverRouteOverride?: RouteFeature | null;
  driverRouteSummaryOverride?: RouteSummary | null;
  turnMarkers?: GeoJSON.FeatureCollection<GeoJSON.Point> | null;
  trafficFlow?: GeoJSON.FeatureCollection<GeoJSON.LineString> | null;
  incidents?: GeoJSON.FeatureCollection<GeoJSON.Point> | null;
  pois?: GeoJSON.FeatureCollection<GeoJSON.Point> | null;
}

const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";
const DEFAULT_CENTER: [number, number] = [-85.1394, 41.0793];
const DEFAULT_ZOOM = 11;
const ROUTE_SOURCE_ID = "otw-route-source";
const ROUTE_LAYER_ID = "otw-route-layer";
const DRIVER_ROUTE_SOURCE_ID = "otw-driver-route-source";
const DRIVER_ROUTE_LAYER_ID = "otw-driver-route-layer";
const TURN_SOURCE_ID = "otw-turn-source";
const TURN_LAYER_ID = "otw-turn-layer";
const TURN_LABEL_LAYER_ID = "otw-turn-label-layer";
const TRAFFIC_SOURCE_ID = "otw-traffic-source";
const TRAFFIC_LAYER_ID = "otw-traffic-layer";
const INCIDENT_SOURCE_ID = "otw-incident-source";
const INCIDENT_LAYER_ID = "otw-incident-layer";
const POI_SOURCE_ID = "otw-poi-source";
const POI_LAYER_ID = "otw-poi-layer";

type MapMarker = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  color: string;
};

type RouteFeature = GeoJSON.Feature<GeoJSON.LineString>;
type LinePaint = NonNullable<maplibregl.LineLayerSpecification["paint"]>;
type DriverTarget =
  | { label: string; coords: [number, number] }
  | null;

type RouteSummary = {
  distanceText: string;
  durationText: string;
};

const formatDistance = (meters?: number) => {
  if (typeof meters !== "number" || Number.isNaN(meters)) return null;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters.toFixed(0)} m`;
};

const formatDuration = (seconds?: number) => {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) return null;
  if (seconds >= 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.max(1, Math.round(seconds / 60))} min`;
};

const makeFallbackLine = (start: [number, number], end: [number, number]): RouteFeature => ({
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [start, end],
  },
  properties: {},
});

const coordsEqual = (a?: OtwLocation, b?: OtwLocation) =>
  !!a &&
  !!b &&
  Math.abs(a.lat - b.lat) < 0.00001 &&
  Math.abs(a.lng - b.lng) < 0.00001;

type JobPhase = "TO_PICKUP" | "TO_DROPOFF" | "NONE";

const getJobPhase = (status?: string): JobPhase => {
  const normalized = String(status || "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();

  if (!normalized) return "TO_PICKUP";

  if (
    normalized === "DELIVERED" ||
    normalized === "COMPLETED" ||
    normalized === "CANCELED" ||
    normalized === "CANCELLED"
  ) {
    return "NONE";
  }

  if (normalized === "PICKED_UP" || normalized === "EN_ROUTE") {
    return "TO_DROPOFF";
  }

  if (normalized === "ASSIGNED" || normalized === "MATCHED" || normalized === "ACCEPTED") {
    return "TO_PICKUP";
  }

  return "TO_PICKUP";
};

const haversineKm = (a: OtwLocation, b: OtwLocation) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const formatUpdatedAgo = (iso?: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return "just now";
  const minutes = Math.round(diff / 60000);
  if (minutes < 90) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
};

const OtwLiveMap = ({
  pickup,
  dropoff,
  customer,
  requestId,
  jobStatus,
  focusDriverId,
  drivers = [],
  useExternalRoutes = false,
  mainRouteOverride,
  mainRouteSummaryOverride,
  driverRouteOverride,
  driverRouteSummaryOverride,
  turnMarkers,
  trafficFlow,
  incidents,
  pois,
}: OtwLiveMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const mapReadyRef = useRef(false);
  const protocolRef = useRef<Protocol | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mainRoute, setMainRoute] = useState<RouteFeature | null>(null);
  const [mainRouteSummary, setMainRouteSummary] = useState<RouteSummary | null>(null);
  const [driverRoute, setDriverRoute] = useState<RouteFeature | null>(null);
  const [driverRouteSummary, setDriverRouteSummary] = useState<RouteSummary | null>(null);
  const [activeDriver, setActiveDriver] = useState<OtwDriverLocation | null>(null);
  const [driverTarget, setDriverTarget] = useState<DriverTarget>(null);

  const jobPickup = pickup;
  const jobDestination = customer ?? dropoff;
  const jobPhase = getJobPhase(jobStatus);
  const resolvedMainRoute = mainRouteOverride ?? mainRoute;
  const resolvedMainSummary = mainRouteSummaryOverride ?? mainRouteSummary;
  const resolvedDriverRoute = driverRouteOverride ?? driverRoute;
  const resolvedDriverSummary = driverRouteSummaryOverride ?? driverRouteSummary;

  useEffect(() => {
    setMounted(true);
  }, []);

  const markerData = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];
    if (jobPickup) {
      markers.push({
        id: "pickup",
        label: jobPickup.label || "Pickup",
        lat: jobPickup.lat,
        lng: jobPickup.lng,
        color: "#34d399",
      });
    }

    const customerEqualsDropoff = coordsEqual(customer, dropoff);

    if (customer && !coordsEqual(customer, jobPickup)) {
      markers.push({
        id: customerEqualsDropoff ? "destination" : "customer",
        label: customer.label || (customerEqualsDropoff ? "Destination" : "Customer"),
        lat: customer.lat,
        lng: customer.lng,
        color: "#c084fc",
      });
    }

    if (dropoff && !customerEqualsDropoff && !coordsEqual(dropoff, jobPickup)) {
      markers.push({
        id: "dropoff",
        label: dropoff.label || "Dropoff",
        lat: dropoff.lat,
        lng: dropoff.lng,
        color: "#f59e0b",
      });
    }
    drivers.forEach((driver, index) => {
      const isFocus = focusDriverId && driver.driverId === focusDriverId;
      markers.push({
        id: `driver-${driver.driverId}-${index}`,
        label: isFocus ? "Driver (You)" : driver.driverId || "Driver",
        lat: driver.location.lat,
        lng: driver.location.lng,
        color: "#60a5fa",
      });
    });
    return markers;
  }, [customer, drivers, dropoff, focusDriverId, jobPickup]);

  const routingDriver = useMemo(() => {
    if (!drivers.length) return null;
    if (jobPhase === "NONE") return null;

    if (focusDriverId) {
      const match = drivers.find((d) => d.driverId === focusDriverId);
      if (match) return match;
    }

    const scoped = requestId
      ? drivers.filter((d) => d.currentRequestId === requestId)
      : drivers;
    const pool = scoped.length > 0 ? scoped : drivers;

    const targetLocation =
      jobPhase === "TO_DROPOFF"
        ? jobDestination
        : jobPhase === "TO_PICKUP"
          ? jobPickup
          : null;

    if (targetLocation) {
      const withDistance = pool
        .map((d) => ({ d, distanceKm: haversineKm(d.location, targetLocation) }))
        .sort((a, b) => a.distanceKm - b.distanceKm);
      if (withDistance[0]?.d) return withDistance[0].d;
    }

    const sorted = [...pool].sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
    return sorted[0] ?? null;
  }, [drivers, focusDriverId, jobDestination, jobPhase, jobPickup, requestId]);

  useEffect(() => {
    const targetLocation =
      jobPhase === "TO_DROPOFF"
        ? jobDestination
        : jobPhase === "TO_PICKUP"
          ? jobPickup
          : null;
    if (routingDriver && targetLocation) {
      setActiveDriver(routingDriver);
      setDriverTarget({
        label: targetLocation.label || "Target",
        coords: [targetLocation.lng, targetLocation.lat],
      });
    } else {
      setActiveDriver(null);
      setDriverTarget(null);
    }
  }, [jobDestination, jobPhase, jobPickup, routingDriver]);

  const hasAny = markerData.length > 0;

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    protocolRef.current = protocol;

    return () => {
      maplibregl.removeProtocol("pmtiles");
      protocolRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on("load", () => {
      mapReadyRef.current = true;
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (useExternalRoutes || mainRouteOverride) return;
    if (!jobPickup || !jobDestination) {
      setMainRoute(null);
      setMainRouteSummary(null);
      return;
    }

    if (coordsEqual(jobPickup, jobDestination)) {
      setMainRoute(makeFallbackLine([jobPickup.lng, jobPickup.lat], [jobDestination.lng, jobDestination.lat]));
      setMainRouteSummary({ distanceText: "0 m", durationText: "0 min" });
      return;
    }

    const controller = new AbortController();

    const fetchRoute = async () => {
      const url = `https://router.project-osrm.org/route/v1/driving/${jobPickup.lng},${jobPickup.lat};${jobDestination.lng},${jobDestination.lat}?overview=full&geometries=geojson`;

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Route request failed with status ${res.status}`);
        }
        const data = (await res.json()) as {
          routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }[];
        };
        const first = data.routes?.[0];
        if (first?.geometry?.coordinates?.length) {
          setMainRoute({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: first.geometry.coordinates,
            },
            properties: {},
          });
          setMainRouteSummary({
            distanceText: formatDistance(first.distance) || "–",
            durationText: formatDuration(first.duration) || "–",
          });
          return;
        }
        throw new Error("No route geometry returned");
      } catch (error) {
        if (controller.signal.aborted) return;
        setMainRoute(
          makeFallbackLine(
            [jobPickup.lng, jobPickup.lat],
            [jobDestination.lng, jobDestination.lat]
          )
        );
        setMainRouteSummary(null);
        console.error("[OTW map] Falling back to straight line route", error);
      }
    };

    fetchRoute();

    return () => controller.abort();
  }, [jobDestination, jobPickup, mainRouteOverride, useExternalRoutes]);

  useEffect(() => {
    if (useExternalRoutes || driverRouteOverride) return;
    const target = driverTarget;
    const driver = activeDriver;
    if (!driver || !target) {
      setDriverRoute(null);
      setDriverRouteSummary(null);
      return;
    }

    const driverLocation: OtwLocation = {
      lat: driver.location.lat,
      lng: driver.location.lng,
      label: driver.location.label,
    };
    const targetLocation: OtwLocation = {
      lat: target.coords[1],
      lng: target.coords[0],
      label: target.label,
    };

    if (coordsEqual(driverLocation, targetLocation)) {
      setDriverRoute(makeFallbackLine([driver.location.lng, driver.location.lat], [target.coords[0], target.coords[1]]));
      setDriverRouteSummary({ distanceText: "0 m", durationText: "0 min" });
      return;
    }

    const controller = new AbortController();

    const fetchDriverLeg = async () => {
      const url = `https://router.project-osrm.org/route/v1/driving/${driver.location.lng},${driver.location.lat};${target.coords[0]},${target.coords[1]}?overview=full&geometries=geojson`;

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Driver leg failed with status ${res.status}`);
        }
        const data = (await res.json()) as {
          routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }[];
        };
        const first = data.routes?.[0];
        if (first?.geometry?.coordinates?.length) {
          setDriverRoute({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: first.geometry.coordinates,
            },
            properties: {},
          });
          setDriverRouteSummary({
            distanceText: formatDistance(first.distance) || "–",
            durationText: formatDuration(first.duration) || "–",
          });
          return;
        }
        throw new Error("No driver leg geometry returned");
      } catch (error) {
        if (controller.signal.aborted) return;
        setDriverRoute(
          makeFallbackLine(
            [driver.location.lng, driver.location.lat],
            [target.coords[0], target.coords[1]]
          )
        );
        setDriverRouteSummary(null);
        console.error("[OTW map] Falling back to straight line driver leg", error);
      }
    };

    fetchDriverLeg();
    return () => controller.abort();
  }, [activeDriver, driverRouteOverride, driverTarget, useExternalRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyUpdates = () => {
      const updateLineLayer = ({
        sourceId,
        layerId,
        data,
        paint,
      }: {
        sourceId: string;
        layerId: string;
        data: RouteFeature | null;
        paint: LinePaint;
      }) => {
        if (!data) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
          return;
        }

        if (map.getSource(sourceId)) {
          (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data);
        } else {
          map.addSource(sourceId, {
            type: "geojson",
            lineMetrics: true,
            data,
          });
        }

        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
            paint,
          });
        }
      };
      const updateGeoLayer = ({
        sourceId,
        layerId,
        data,
        type,
        paint,
        layout,
      }: {
        sourceId: string;
        layerId: string;
        data: GeoJSON.FeatureCollection | null;
        type: "line" | "circle" | "symbol";
        paint: Record<string, unknown>;
        layout?: Record<string, unknown>;
      }) => {
        if (!data) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
          return;
        }

        if (map.getSource(sourceId)) {
          (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data);
        } else {
          map.addSource(sourceId, {
            type: "geojson",
            data,
          });
        }

        if (!map.getLayer(layerId)) {
          const nextLayer: maplibregl.LayerSpecification = {
            id: layerId,
            type,
            source: sourceId,
            paint,
            ...(layout ? { layout } : {}),
          } as maplibregl.LayerSpecification;
          map.addLayer(nextLayer);
        }
      };

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      markerData.forEach((marker) => {
        const markerInstance = new maplibregl.Marker({ color: marker.color })
          .setLngLat([marker.lng, marker.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(marker.label));
        markerInstance.addTo(map);
        markersRef.current.push(markerInstance);
      });

      updateLineLayer({
        sourceId: ROUTE_SOURCE_ID,
        layerId: ROUTE_LAYER_ID,
        data: resolvedMainRoute,
        paint: {
          "line-color": "#22c55e",
          "line-width": 5,
          "line-opacity": 0.9,
        },
      });

      updateLineLayer({
        sourceId: DRIVER_ROUTE_SOURCE_ID,
        layerId: DRIVER_ROUTE_LAYER_ID,
        data: resolvedDriverRoute,
        paint: {
          "line-color": "#60a5fa",
          "line-width": 4,
          "line-opacity": 0.7,
          "line-dasharray": [2, 1.5],
        },
      });

      updateGeoLayer({
        sourceId: TRAFFIC_SOURCE_ID,
        layerId: TRAFFIC_LAYER_ID,
        data: trafficFlow ?? null,
        type: "line",
        paint: {
          "line-color": [
            "step",
            ["coalesce", ["get", "jamFactor"], 0],
            "#16a34a",
            2,
            "#eab308",
            5,
            "#ef4444",
            8,
            "#111827",
          ],
          "line-width": 3,
          "line-opacity": 0.6,
        },
      });

      updateGeoLayer({
        sourceId: INCIDENT_SOURCE_ID,
        layerId: INCIDENT_LAYER_ID,
        data: incidents ?? null,
        type: "circle",
        paint: {
          "circle-radius": 5,
          "circle-color": [
            "match",
            ["downcase", ["to-string", ["get", "severity"]]],
            "critical",
            "#dc2626",
            "major",
            "#f97316",
            "minor",
            "#f59e0b",
            "#f59e0b",
          ],
          "circle-stroke-color": "#111827",
          "circle-stroke-width": 1,
        },
      });

      updateGeoLayer({
        sourceId: POI_SOURCE_ID,
        layerId: POI_LAYER_ID,
        data: pois ?? null,
        type: "circle",
        paint: {
          "circle-radius": 4,
          "circle-color": "#fbbf24",
          "circle-stroke-color": "#111827",
          "circle-stroke-width": 1,
        },
      });

      if (turnMarkers) {
        updateGeoLayer({
          sourceId: TURN_SOURCE_ID,
          layerId: TURN_LAYER_ID,
          data: turnMarkers,
          type: "circle",
          paint: {
            "circle-radius": 5,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#0f172a",
            "circle-stroke-width": 1,
          },
        });

        updateGeoLayer({
          sourceId: TURN_SOURCE_ID,
          layerId: TURN_LABEL_LAYER_ID,
          data: turnMarkers,
          type: "symbol",
          layout: {
            "text-field": ["get", "label"],
            "text-size": 10,
            "text-offset": [0, 1.1],
            "text-anchor": "top",
          },
          paint: {
            "text-color": "#fef08a",
            "text-halo-color": "#0f172a",
            "text-halo-width": 1,
          },
        });
      } else {
        if (map.getLayer(TURN_LABEL_LAYER_ID)) map.removeLayer(TURN_LABEL_LAYER_ID);
        if (map.getLayer(TURN_LAYER_ID)) map.removeLayer(TURN_LAYER_ID);
        if (map.getSource(TURN_SOURCE_ID)) map.removeSource(TURN_SOURCE_ID);
      }

      const boundsCoordinates: [number, number][] = [];
      markerData.forEach((marker) => boundsCoordinates.push([marker.lng, marker.lat]));
      if (resolvedMainRoute?.geometry?.coordinates) {
        resolvedMainRoute.geometry.coordinates.forEach((coord) => {
          const [lng, lat] = coord;
          boundsCoordinates.push([lng, lat]);
        });
      }
      if (resolvedDriverRoute?.geometry?.coordinates) {
        resolvedDriverRoute.geometry.coordinates.forEach((coord) => {
          const [lng, lat] = coord;
          boundsCoordinates.push([lng, lat]);
        });
      }
      if (turnMarkers?.features?.length) {
        turnMarkers.features.forEach((feature) => {
          const coords = feature.geometry.coordinates as [number, number];
          boundsCoordinates.push(coords);
        });
      }

      if (boundsCoordinates.length > 0) {
        const bounds = boundsCoordinates.reduce(
          (acc, coord) => acc.extend(coord),
          new maplibregl.LngLatBounds(boundsCoordinates[0], boundsCoordinates[0])
        );
        map.fitBounds(bounds, { padding: 72, duration: 700, maxZoom: 15 });
      } else {
        map.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
      }
    };

    if (!mapReadyRef.current) {
      map.once("load", applyUpdates);
      return;
    }

    applyUpdates();
  }, [markerData, resolvedMainRoute, resolvedDriverRoute, turnMarkers, trafficFlow, incidents, pois]);

  const statusLines: string[] = [];

  const driverUpdatedAgo = mounted ? formatUpdatedAgo(activeDriver?.updatedAt) : null;

  if (resolvedMainSummary) {
    statusLines.push(
      `Job route: ${resolvedMainSummary.distanceText} • ${resolvedMainSummary.durationText}`
    );
  } else if (jobPickup && jobDestination) {
    statusLines.push("Job route: calculating...");
  } else if (jobPickup || jobDestination) {
    statusLines.push("Job route: add pickup and destination to unlock directions.");
  }

  if (resolvedDriverSummary && activeDriver && driverTarget) {
    statusLines.push(
      `Driver ➜ ${driverTarget.label}: ${resolvedDriverSummary.distanceText} • ${resolvedDriverSummary.durationText}` +
        (driverUpdatedAgo ? ` (${driverUpdatedAgo})` : "")
    );
  } else if (activeDriver && driverTarget) {
    statusLines.push(
      `Driver ➜ ${driverTarget.label}: syncing…` +
        (driverUpdatedAgo ? ` (last seen ${driverUpdatedAgo})` : "")
    );
  } else if (drivers.length > 0) {
    statusLines.push("Driver leg: add pickup and destination to anchor directions.");
  }

  return (
    <div className={styles.mapShell}>
      <div className={styles.mapHeaderRow}>
        <span className={styles.mapTitle}>Live OTW Map</span>
        <span className={styles.mapHint}>
          {hasAny ? "Live tracker with turn-by-turn geometry" : "Waiting for route data"}
        </span>
      </div>
      <div className={styles.mapCanvas}>
        <div ref={mapContainerRef} className={styles.mapFrame} />
        {statusLines.length > 0 && (
          <div className={styles.mapStatus}>
            {statusLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        )}
        {!hasAny && statusLines.length === 0 && (
          <div className={styles.mapStatus}>Live tracking will appear once a route is assigned.</div>
        )}
      </div>
      <div className={styles.mapLegend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchPickup}`} />
          Pickup
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchCustomer}`} />
          Customer
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchDropoff}`} />
          Dropoff
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchDriver}`} />
          Driver
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchRoute}`} />
          Route
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchDriverRoute}`} />
          Driver Leg
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchTurn}`} />
          Turn Markers
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchTraffic}`} />
          Traffic Flow
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchIncident}`} />
          Incidents
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchPoi}`} />
          POIs
        </span>
      </div>
    </div>
  );
};

export default OtwLiveMap;
