import { decodeFlexiblePolyline } from "./navigation/flexiblePolyline";
import { decodeEncodedPolyline } from "./navigation/encodedPolyline";

type Stop = { lat: number; lng: number; type?: string };

type HereRouteResponse = {
  routes?: Array<{
    sections?: Array<{
      polyline?: string;
      summary?: { length?: number; duration?: number };
    }>;
  }>;
};

export const buildRoutingV8Url = ({
  origin,
  stops,
  apiKey,
  mode = "car",
  avoid,
}: {
  origin: Stop;
  stops: Stop[];
  apiKey: string;
  mode?: "car";
  avoid?: { tolls?: boolean; ferries?: boolean };
}) => {
  const url = new URL("https://router.hereapi.com/v8/routes");
  url.searchParams.set("transportMode", mode);
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`);

  const allStops = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const destination = allStops[allStops.length - 1];
  const vias = allStops.slice(0, -1);

  if (!destination) {
    throw new Error("Destination stop is missing.");
  }

  vias.forEach((via) => {
    url.searchParams.append("via", `${via.lat},${via.lng}`);
  });
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("return", "summary,polyline");
  url.searchParams.set("polyline", "flexible");
  url.searchParams.set("routingMode", "fast");
  url.searchParams.set("apiKey", apiKey);

  const avoidFeatures: string[] = [];
  if (avoid?.tolls) avoidFeatures.push("tollroad");
  if (avoid?.ferries) avoidFeatures.push("ferry");
  if (avoidFeatures.length) {
    url.searchParams.set("avoid[features]", avoidFeatures.join(","));
  }

  return url.toString();
};

export const safeFetchJson = async <T = unknown>(url: string, init?: RequestInit) => {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[HERE_ROUTING_ERROR]", res.status, text.slice(0, 500));
    throw new Error(`Upstream HERE error: ${res.status}`);
  }
  return res.json() as Promise<T>;
};

export const parseHereRouteToOtw = (payload: HereRouteResponse, stopCount: number) => {
  const section = payload.routes?.[0]?.sections;
  const first = section?.[0];
  const polyline = first?.polyline;
  if (!polyline) {
    return {
      coordinates: null,
      polyline: null,
      distanceMeters: 0,
      durationSeconds: 0,
      legs: [],
    };
  }

  let coords: [number, number][] = [];
  try {
    coords = decodeFlexiblePolyline(polyline);
  } catch (err) {
    try {
      coords = decodeEncodedPolyline(polyline);
    } catch (_err) {
      console.error("Failed to decode HERE polyline", err);
      coords = [];
    }
  }

  const summary = first.summary || {};
  const legs =
    section?.map((sec, idx) => ({
      toStopIndex: Math.min(idx + 1, Math.max(stopCount - 1, 0)),
      distanceMeters: sec.summary?.length ?? 0,
      durationSeconds: sec.summary?.duration ?? 0,
    })) || [];

  const distanceMeters =
    section?.reduce((sum, sec) => sum + (sec.summary?.length ?? 0), 0) ?? 0;
  const durationSeconds =
    section?.reduce((sum, sec) => sum + (sec.summary?.duration ?? 0), 0) ?? 0;

  return {
    coordinates: coords.map(([lng, lat]) => ({ lat, lng })),
    polyline,
    distanceMeters,
    durationSeconds,
    legs,
  };
};

type HereSequenceResponse = {
  results?: Array<{
    waypoints?: Array<{
      id?: string;
      lat?: number;
      lng?: number;
      sequence?: number;
    }>;
    distance?: number;
    time?: number;
  }>;
};

const routeCache = new Map<
  string,
  { expires: number; data: ReturnType<typeof parseHereRouteToOtw> }
>();

export const cacheRouteResponse = (key: string, data: ReturnType<typeof parseHereRouteToOtw>) => {
  routeCache.set(key, { expires: Date.now() + 20_000, data });
};

export const getCachedRouteResponse = (key: string) => {
  const hit = routeCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    routeCache.delete(key);
    return null;
  }
  return hit.data;
};

export const buildWaypointsSequenceUrl = ({
  start,
  stops,
  apiKey,
  improveFor,
}: {
  start: { lat: number; lng: number };
  stops: Array<{ id: string; lat: number; lng: number }>;
  apiKey: string;
  improveFor: "time" | "distance";
}) => {
  const url = new URL("https://wps.hereapi.com/v8/findsequence");
  url.searchParams.set("start", `${start.lat},${start.lng};id=start`);
  url.searchParams.set("end", `${start.lat},${start.lng};id=end`);
  url.searchParams.set("improveFor", improveFor);
  stops.forEach((stop) => {
    url.searchParams.append("destination", `${stop.lat},${stop.lng};id=${stop.id}`);
  });
  url.searchParams.set("apiKey", apiKey);
  return url.toString();
};

export const parseHereSequenceToOtw = (
  payload: HereSequenceResponse,
  stopIds: Set<string>
) => {
  const result = payload.results?.[0];
  if (!result?.waypoints) {
    return {
      orderedStops: [],
      ordered: [],
      summary: {},
    };
  }

  const ordered = [...result.waypoints]
    .filter((wp) => wp.id && stopIds.has(wp.id))
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((wp) => ({
      id: wp.id as string,
      lat: Number(wp.lat ?? 0),
      lng: Number(wp.lng ?? 0),
    }));

  const orderedStops = ordered.map((wp) => wp.id);

  return {
    orderedStops,
    ordered,
    summary: {
      distanceMeters: result.distance,
      durationSeconds: result.time,
    },
  };
};
