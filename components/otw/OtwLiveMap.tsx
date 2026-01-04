"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import styles from "./OtwLiveMap.module.css";
import type { OtwLocation } from "@/lib/otw/otwTypes";
import type { OtwDriverLocation } from "@/lib/otw/otwDriverLocation";

interface OtwLiveMapProps {
  pickup?: OtwLocation;
  dropoff?: OtwLocation;
  drivers?: OtwDriverLocation[];
}

const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";
const DEFAULT_CENTER: [number, number] = [-85.1394, 41.0793];
const DEFAULT_ZOOM = 11;
const ROUTE_SOURCE_ID = "otw-route-source";
const ROUTE_LAYER_ID = "otw-route-layer";

type MapMarker = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  color: string;
};

const OtwLiveMap: React.FC<OtwLiveMapProps> = ({ pickup, dropoff, drivers = [] }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const mapReadyRef = useRef(false);

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
  }, [drivers, dropoff, pickup]);

  const hasAny = markerData.length > 0;

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
    const map = mapRef.current;
    if (!map) return;

    const applyUpdates = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      markerData.forEach((marker) => {
        const markerInstance = new maplibregl.Marker({ color: marker.color })
          .setLngLat([marker.lng, marker.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(marker.label));
        markerInstance.addTo(map);
        markersRef.current.push(markerInstance);
      });

      if (pickup && dropoff) {
        const routeData = {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [pickup.lng, pickup.lat],
              [dropoff.lng, dropoff.lat],
            ],
          },
          properties: {},
        };

        if (map.getSource(ROUTE_SOURCE_ID)) {
          (map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource).setData(routeData);
        } else {
          map.addSource(ROUTE_SOURCE_ID, {
            type: "geojson",
            data: routeData,
          });
          map.addLayer({
            id: ROUTE_LAYER_ID,
            type: "line",
            source: ROUTE_SOURCE_ID,
            paint: {
              "line-color": "#f59e0b",
              "line-width": 3,
              "line-dasharray": [1.5, 1.5],
            },
          });
        }
      } else if (map.getLayer(ROUTE_LAYER_ID)) {
        map.removeLayer(ROUTE_LAYER_ID);
        if (map.getSource(ROUTE_SOURCE_ID)) {
          map.removeSource(ROUTE_SOURCE_ID);
        }
      }

      if (markerData.length > 0) {
        const bounds = markerData.reduce(
          (acc, marker) => acc.extend([marker.lng, marker.lat]),
          new maplibregl.LngLatBounds(
            [markerData[0].lng, markerData[0].lat],
            [markerData[0].lng, markerData[0].lat]
          )
        );
        map.fitBounds(bounds, { padding: 64, duration: 600, maxZoom: 14 });
      } else {
        map.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
      }
    };

    if (!mapReadyRef.current) {
      map.once("load", applyUpdates);
      return;
    }

    applyUpdates();
  }, [markerData, pickup, dropoff]);

  return (
    <div className={styles.mapShell}>
      <div className={styles.mapHeaderRow}>
        <span className={styles.mapTitle}>Live OTW Map</span>
        <span className={styles.mapHint}>
          {hasAny ? "Active route view" : "Waiting for route data"}
        </span>
      </div>
      <div className={styles.mapCanvas}>
        <div ref={mapContainerRef} className={styles.mapFrame} />
        {!hasAny && (
          <div className={styles.mapStatus}>
            Live tracking will appear once a route is assigned.
          </div>
        )}
      </div>
      <div className={styles.mapLegend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchPickup}`} />
          Pickup
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchDropoff}`} />
          Dropoff
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.swatchDriver}`} />
          Driver
        </span>
      </div>
    </div>
  );
};

export default OtwLiveMap;
