import { OtwLocation } from "./otwTypes";

/**
 * Basic Haversine formula: distance between two lat/lng points in KM.
 * We can replace/augment this with a more advanced engine later.
 */
export const haversineDistanceKm = (
  a: OtwLocation,
  b: OtwLocation
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const R = 6371; // Earth radius in KM
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  const distance = R * c;
  return Number.isFinite(distance) ? distance : 0;
};

/**
 * Very rough drive time estimate (in minutes) using a simple
 * average speed for city/suburban driving.
 */
export const estimateDurationMinutes = (distanceKm: number): number => {
  if (distanceKm <= 0) return 0;

  // Example average speed: 35 km/h (tweak later)
  const avgSpeedKmH = 35;
  const hours = distanceKm / avgSpeedKmH;
  const minutes = Math.round(hours * 60);

  return minutes;
};

export interface OtwRouteMetrics {
  distanceKm: number;
  durationMinutes: number;
  complexityFactor?: number; // can be boosted for heavy hauls, bad weather, etc.
}

/**
 * Convert a route into OTW miles.
 * This is where the "mileage isn't actual miles" logic lives.
 *
 * You can change the scaling whenever you refine the model.
 */
export const otwMilesFromRoute = ({
  distanceKm,
  durationMinutes,
  complexityFactor = 1,
}: OtwRouteMetrics): number => {
  if (distanceKm <= 0 || durationMinutes <= 0) {
    return 0;
  }

  // Base factors (tweak to taste)
  const distanceWeight = 0.7;
  const timeWeight = 0.3;

  const baseMiles =
    distanceKm * 100 * distanceWeight + // 1 km ≈ 100 OTW units baseline
    durationMinutes * 10 * timeWeight; // time matters for traffic/effort

  const adjustedMiles = baseMiles * complexityFactor;

  return Math.round(adjustedMiles);
};

