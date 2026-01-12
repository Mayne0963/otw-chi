import { decodeFlexiblePolyline } from "./flexiblePolyline";
import { decodeEncodedPolyline } from "./encodedPolyline";

export type HereRouteResponse = {
  routes?: Array<{
    id?: string;
    sections?: Array<{
      id?: string;
      polyline?: string;
      summary?: {
        length?: number;
        duration?: number;
        baseDuration?: number;
        trafficDelay?: number;
        typicalDuration?: number;
      };
      actions?: Array<{
        id?: string;
        action?: string;
        direction?: string;
        offset?: number;
        length?: number;
        duration?: number;
        instruction?: { text?: string };
        roadName?: string;
        exitNumber?: string;
        entranceNumber?: string;
        lanes?: Array<{
          valid?: boolean;
          laneType?: string;
          directions?: string[];
        }>;
      }>;
      spans?: Array<{
        offset?: number;
        length?: number;
        speedLimit?: number;
        speedLimitUnit?: string;
        baseDuration?: number;
        trafficDelay?: number;
      }>;
    }>;
  }>;
};

type HereRoute = NonNullable<HereRouteResponse["routes"]>[number];

export type NavigationSpan = {
  offset: number;
  length: number;
  speedLimit?: number;
  speedLimitUnit?: string;
  baseDuration?: number;
  trafficDelay?: number;
};

export type NavigationManeuver = {
  id: string;
  action?: string;
  direction?: string;
  instruction?: string;
  roadName?: string;
  exitNumber?: string;
  entranceNumber?: string;
  offset: number;
  length?: number;
  duration?: number;
  location: { lat: number; lng: number };
  lanes?: Array<{
    valid?: boolean;
    laneType?: string;
    directions?: string[];
  }>;
};

export type NavigationSummary = {
  length?: number;
  duration?: number;
  baseDuration?: number;
  trafficDelay?: number;
  typicalDuration?: number;
};

export type NavigationRoute = {
  geometry: GeoJSON.Feature<GeoJSON.LineString>;
  summary: NavigationSummary;
  maneuvers: NavigationManeuver[];
  spans: NavigationSpan[];
  bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number };
};

const buildBounds = (coords: [number, number][]) => {
  let minLat = Number.POSITIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  coords.forEach(([lng, lat]) => {
    minLat = Math.min(minLat, lat);
    minLng = Math.min(minLng, lng);
    maxLat = Math.max(maxLat, lat);
    maxLng = Math.max(maxLng, lng);
  });
  return { minLat, minLng, maxLat, maxLng };
};

const parseRoute = (route?: HereRoute | null): NavigationRoute | null => {
  const section = route?.sections?.find((entry) => Boolean(entry?.polyline));
  if (!section?.polyline || typeof section.polyline !== "string") return null;

  let coords: [number, number][];
  try {
    coords = decodeFlexiblePolyline(section.polyline);
  } catch (error) {
    try {
      coords = decodeEncodedPolyline(section.polyline);
    } catch (fallbackError) {
      console.warn("HERE polyline decode failed:", error);
      console.warn("HERE encoded polyline fallback failed:", fallbackError);
      return null;
    }
  }
  if (!coords.length) return null;

  const summary = section.summary || {};
  const maneuvers: NavigationManeuver[] = (section.actions || []).map((action, idx) => {
    const offset = action.offset ?? 0;
    const coord = coords[Math.min(offset, coords.length - 1)];
    return {
      id: action.id || `maneuver-${idx}`,
      action: action.action,
      direction: action.direction,
      instruction: action.instruction?.text,
      roadName: action.roadName,
      exitNumber: action.exitNumber,
      entranceNumber: action.entranceNumber,
      offset,
      length: action.length,
      duration: action.duration,
      lanes: action.lanes,
      location: { lat: coord[1], lng: coord[0] },
    };
  });

  const spans: NavigationSpan[] = (section.spans || []).map((span) => ({
    offset: span.offset ?? 0,
    length: span.length ?? 0,
    speedLimit: span.speedLimit,
    speedLimitUnit: span.speedLimitUnit,
    baseDuration: span.baseDuration,
    trafficDelay: span.trafficDelay,
  }));

  return {
    geometry: {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
      properties: {},
    },
    summary,
    maneuvers,
    spans,
    bounds: buildBounds(coords),
  };
};

export const parseHereRoute = (payload: HereRouteResponse): NavigationRoute | null => {
  const route = payload.routes?.[0];
  if (!route) return null;
  return parseRoute(route);
};

export const parseHereAlternatives = (payload: HereRouteResponse): NavigationRoute[] => {
  const routes = payload.routes || [];
  if (routes.length <= 1) return [];
  return routes
    .slice(1)
    .map((route) => parseRoute(route))
    .filter((route): route is NavigationRoute => !!route);
};
