import { validateAddress } from '@/lib/geocoding';
import type { OtwLocation } from '@/lib/otw/otwTypes';
import {
  getRequestRouteStopLabel,
  getRequestRouteStops,
  hasRouteStopCoordinates,
  type RequestRouteStopType,
} from '@/lib/request-stops';

export type ResolvedRequestRouteLocation = OtwLocation & {
  type: RequestRouteStopType;
  address: string;
};

async function geocodeAddressWithFallback(address: string) {
  const normalized = address.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const withoutCountry = normalized.replace(/,\s*United States$/i, '').trim();
  const parts = withoutCountry
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const withoutVenue = parts.length > 1 ? parts.slice(1).join(', ') : withoutCountry;
  const localityTail = parts.length > 4 ? parts.slice(parts.length - 4).join(', ') : withoutCountry;

  const candidates = Array.from(
    new Set([normalized, withoutCountry, withoutVenue, localityTail].filter((value) => value.length >= 5))
  );

  for (const candidate of candidates) {
    const result = await validateAddress(candidate).catch(() => null);
    if (result) return result;
  }

  return null;
}

export async function resolveRequestRouteLocations(input: {
  quoteBreakdown: unknown;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
}): Promise<ResolvedRequestRouteLocation[]> {
  const stops = getRequestRouteStops(input.quoteBreakdown, {
    pickupAddress: input.pickupAddress,
    dropoffAddress: input.dropoffAddress,
  });
  const resolved: ResolvedRequestRouteLocation[] = [];

  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    let lat = hasRouteStopCoordinates(stop) ? stop.lat : null;
    let lng = hasRouteStopCoordinates(stop) ? stop.lng : null;
    let label = stop.label ?? getRequestRouteStopLabel(stop, index);

    if ((lat == null || lng == null) && stop.address) {
      const geocoded = await geocodeAddressWithFallback(stop.address);
      if (geocoded) {
        lat = geocoded.latitude;
        lng = geocoded.longitude;
        if (!stop.label) {
          label = geocoded.placeName || geocoded.formattedAddress || label;
        }
      }
    }

    if (lat == null || lng == null) {
      continue;
    }

    resolved.push({
      type: stop.type,
      address: stop.address,
      lat,
      lng,
      label,
    });
  }

  return resolved;
}

export function splitResolvedRequestRouteLocations(routeLocations: ResolvedRequestRouteLocation[]): {
  pickup: OtwLocation | null;
  waypoints: OtwLocation[];
  dropoff: OtwLocation | null;
} {
  const pickupLocation =
    routeLocations.find((location) => location.type === 'pickup') ?? routeLocations[0] ?? null;
  const dropoffLocation =
    [...routeLocations].reverse().find((location) => location.type === 'dropoff') ??
    routeLocations[routeLocations.length - 1] ??
    null;
  const waypoints = routeLocations.filter((location) => location.type === 'waypoint');

  return {
    pickup: pickupLocation
      ? {
          lat: pickupLocation.lat,
          lng: pickupLocation.lng,
          label: pickupLocation.label,
        }
      : null,
    waypoints: waypoints.map((location) => ({
      lat: location.lat,
      lng: location.lng,
      label: location.label,
    })),
    dropoff: dropoffLocation
      ? {
          lat: dropoffLocation.lat,
          lng: dropoffLocation.lng,
          label: dropoffLocation.label,
        }
      : null,
  };
}
