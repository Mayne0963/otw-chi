import type { NavigationManeuver, NavigationRoute, NavigationSpan } from "./here";
import type { LngLat } from "./geo";
import {
  buildCumulativeDistances,
  distanceToPolyline,
  findClosestPointIndex,
  pointAtDistanceFromIndex,
} from "./geo";

export type GuidanceState = {
  nextManeuver?: NavigationManeuver;
  distanceToNextMeters?: number;
  currentIndex: number;
  distanceFromRouteMeters: number;
  speedLimit?: { value: number; unit?: string } | null;
  cumulativeDistances: number[];
};

const getSpeedLimitForIndex = (spans: NavigationSpan[], index: number) => {
  const span = spans.find(
    (item) => index >= item.offset && index <= item.offset + item.length
  );
  if (!span || typeof span.speedLimit !== "number") return null;
  return { value: span.speedLimit, unit: span.speedLimitUnit };
};

export const buildGuidanceState = (
  route: NavigationRoute,
  location: LngLat
): GuidanceState => {
  const coords = route.geometry.geometry.coordinates as LngLat[];
  const cumulativeDistances = buildCumulativeDistances(coords);
  const currentIndex = findClosestPointIndex(coords, location);
  const distanceFromRouteMeters = distanceToPolyline(coords, location);

  const nextManeuver = route.maneuvers.find((maneuver) => maneuver.offset > currentIndex);
  const nextIndex = nextManeuver?.offset ?? Math.max(coords.length - 1, 0);
  const distanceToNextMeters =
    cumulativeDistances[nextIndex] - cumulativeDistances[currentIndex];

  const speedLimit = getSpeedLimitForIndex(route.spans || [], currentIndex);

  return {
    nextManeuver,
    distanceToNextMeters: Number.isFinite(distanceToNextMeters) ? Math.max(distanceToNextMeters, 0) : undefined,
    currentIndex,
    distanceFromRouteMeters,
    speedLimit,
    cumulativeDistances,
  };
};

export type TurnMarker = {
  id: string;
  distanceMeters: number;
  coordinate: LngLat;
};

export const buildTurnMarkers = (
  route: NavigationRoute,
  maneuver: NavigationManeuver | undefined,
  distances: number[]
): TurnMarker[] => {
  if (!maneuver) return [];
  const coords = route.geometry.geometry.coordinates as LngLat[];
  const cumulative = buildCumulativeDistances(coords);
  const targetDistance = cumulative[maneuver.offset] ?? cumulative[cumulative.length - 1] ?? 0;

  return distances
    .map((distance) => {
      const markerDistance = Math.max(targetDistance - distance, 0);
      const point = pointAtDistanceFromIndex(coords, cumulative, markerDistance);
      if (!point) return null;
      return {
        id: `${maneuver.id}-${distance}`,
        distanceMeters: distance,
        coordinate: point,
      };
    })
    .filter((item): item is TurnMarker => !!item);
};
