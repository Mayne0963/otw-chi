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
  drivers?: OtwDriverLocation[];
}

const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";
const DEFAULT_CENTER: [number, number] = [-85.1394, 41.0793];
const DEFAULT_ZOOM = 11;
const ROUTE_SOURCE_ID = "otw-route-source";
const ROUTE_LAYER_ID = "otw-route-layer";
const DRIVER_ROUTE_SOURCE_ID = "otw-driver-route-source";
const DRIVER_ROUTE_LAYER_ID = "otw-driver-route-layer";

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

const OtwLiveMap: React.FC<OtwLiveMapProps> = ({
  pickup,
  dropoff,
  customer,
  requestId,
  drivers = [],
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const mapReadyRef = useRef(false);
  const protocolRef = useRef<Protocol | null>(null);
  const [mainRoute, setMainRoute] = useState<RouteFeature | null>(null);
  const [mainRouteSummary, setMainRouteSummary] = useState<RouteSummary | null>(null);
  const [driverRoute, setDriverRoute] = useState<RouteFeature | null>(null);
  const [driverRouteSummary, setDriverRouteSummary] = useState<RouteSummary | null>(null);
  const [activeDriver, setActiveDriver] = useState<OtwDriverLocation | null>(null);
  const [driverTarget, setDriverTarget] = useState<DriverTarget>(null);

  const markerData = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [];
    if (pickup) {
      markers.push({
        id: "pickup",
        label: pickup.label || "Pickup",
        lat: pickup.lat,
        lng: pickup.lng,
        color: "#34d399",
      });
    }
    if (customer && !coordsEqual(customer, pickup)) {
      markers.push({
        id: "customer",
        label: customer.label || "Customer",
        lat: customer.lat,
        lng: customer.lng,
        color: "#c084fc",
      });
    }
    if (dropoff) {
      markers.push({
        id: "dropoff",
        label: dropoff.label || "Dropoff",
        lat: dropoff.lat,
        lng: dropoff.lng,
        color: "#f59e0b",
      });
    }
    drivers.forEach((driver, index) => {
      markers.push({
        id: `driver-${driver.driverId}-${index}`,
        label: driver.driverId || "Driver",
        lat: driver.location.lat,
        lng: driver.location.lng,
        color: "#60a5fa",
      });
    });
    return markers;
  }, [customer, drivers, dropoff, pickup]);

  const routingDriver = useMemo(() => {
    if (!drivers.length) return null;
    const relevant = requestId
      ? drivers.filter((d) => d.currentRequestId === requestId)
      : drivers;
    const pool = relevant.length > 0 ? relevant : drivers;
    const sorted = [...pool].sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
    return sorted[0] ?? null;
  }, [drivers, requestId]);

  useEffect(() => {
    const targetLocation = customer ?? pickup ?? dropoff;
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
  }, [customer, dropoff, pickup, routingDriver]);

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
    const routeStart = customer ?? pickup;
    const routeEnd = dropoff ?? null;

    if (!routeStart || !routeEnd) {
      setMainRoute(null);
      setMainRouteSummary(null);
      return;
    }

    const controller = new AbortController();

    const fetchRoute = async () => {
      const url = `https://router.project-osrm.org/route/v1/driving/${routeStart.lng},${routeStart.lat};${routeEnd.lng},${routeEnd.lat}?overview=full&geometries=geojson`;

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
        setMainRoute(makeFallbackLine([routeStart.lng, routeStart.lat], [routeEnd.lng, routeEnd.lat]));
        setMainRouteSummary(null);
        console.error("[OTW map] Falling back to straight line route", error);
      }
    };

    fetchRoute();

    return () => controller.abort();
  }, [customer, dropoff, pickup]);

  useEffect(() => {
    const target = driverTarget;
    const driver = activeDriver;
    if (!driver || !target) {
      setDriverRoute(null);
      setDriverRouteSummary(null);
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
  }, [activeDriver, driverTarget]);

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
        data: mainRoute,
        paint: {
          "line-color": "#22c55e",
          "line-width": 5,
          "line-opacity": 0.9,
        },
      });

      updateLineLayer({
        sourceId: DRIVER_ROUTE_SOURCE_ID,
        layerId: DRIVER_ROUTE_LAYER_ID,
        data: driverRoute,
        paint: {
          "line-color": "#60a5fa",
          "line-width": 4,
          "line-opacity": 0.7,
          "line-dasharray": [2, 1.5],
        },
      });

      const boundsCoordinates: [number, number][] = [];
      markerData.forEach((marker) => boundsCoordinates.push([marker.lng, marker.lat]));
      if (mainRoute?.geometry?.coordinates) {
        mainRoute.geometry.coordinates.forEach((coord) => {
          const [lng, lat] = coord;
          boundsCoordinates.push([lng, lat]);
        });
      }
      if (driverRoute?.geometry?.coordinates) {
        driverRoute.geometry.coordinates.forEach((coord) => {
          const [lng, lat] = coord;
          boundsCoordinates.push([lng, lat]);
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
  }, [markerData, pickup, dropoff, mainRoute, driverRoute]);

  const statusLines: string[] = [];

  const driverUpdatedAgo = formatUpdatedAgo(activeDriver?.updatedAt);

  if (mainRouteSummary) {
    statusLines.push(
      `Customer route: ${mainRouteSummary.distanceText} • ${mainRouteSummary.durationText}`
    );
  } else if (pickup && dropoff) {
    statusLines.push("Customer route: calculating...");
  } else if (pickup || customer || dropoff) {
    statusLines.push("Customer route: add both endpoints to unlock directions.");
  }

  if (driverRouteSummary && activeDriver && driverTarget) {
    statusLines.push(
      `Driver ➜ ${driverTarget.label}: ${driverRouteSummary.distanceText} • ${driverRouteSummary.durationText}` +
        (driverUpdatedAgo ? ` (${driverUpdatedAgo})` : "")
    );
  } else if (activeDriver && driverTarget) {
    statusLines.push(
      `Driver ➜ ${driverTarget.label}: syncing…` +
        (driverUpdatedAgo ? ` (last seen ${driverUpdatedAgo})` : "")
    );
  } else if (drivers.length > 0) {
    statusLines.push("Driver leg: add a customer, pickup, or dropoff to anchor directions.");
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
      </div>
    </div>
  );
};

export default OtwLiveMap;
