export type RequestRouteStopType = 'pickup' | 'waypoint' | 'dropoff';

export type RequestRouteStopInput = {
  address: string;
  lat: number;
  lng: number;
  label?: string | null;
};

export type RequestRouteStop = {
  type: RequestRouteStopType;
  address: string;
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type RequestRouteSnapshot = {
  version: 1;
  stops: Array<{
    type: RequestRouteStopType;
    address: string;
    label?: string | null;
    lat: number;
    lng: number;
  }>;
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized : null;
}

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function toStoredStop(
  type: RequestRouteStopType,
  input: RequestRouteStopInput | null | undefined,
): RequestRouteSnapshot['stops'][number] | null {
  if (!input) return null;

  const address = normalizeString(input.address);
  const lat = coerceFiniteNumber(input.lat);
  const lng = coerceFiniteNumber(input.lng);

  if (!address || lat === null || lng === null) {
    return null;
  }

  return {
    type,
    address,
    label: normalizeOptionalString(input.label),
    lat,
    lng,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readStoredStop(value: unknown): RequestRouteSnapshot['stops'][number] | null {
  if (!isRecord(value)) return null;

  const type = value.type;
  if (type !== 'pickup' && type !== 'waypoint' && type !== 'dropoff') {
    return null;
  }

  const address = normalizeString(value.address);
  const lat = coerceFiniteNumber(value.lat);
  const lng = coerceFiniteNumber(value.lng);

  if (!address || lat === null || lng === null) {
    return null;
  }

  return {
    type,
    address,
    label: normalizeOptionalString(value.label),
    lat,
    lng,
  };
}

export function buildRequestRouteSnapshot(params: {
  pickup: RequestRouteStopInput | null | undefined;
  intermediateStops?: RequestRouteStopInput[];
  dropoff: RequestRouteStopInput | null | undefined;
}): RequestRouteSnapshot | null {
  const pickup = toStoredStop('pickup', params.pickup);
  const dropoff = toStoredStop('dropoff', params.dropoff);

  if (!pickup || !dropoff) {
    return null;
  }

  const intermediateStops = (params.intermediateStops ?? [])
    .map((stop) => toStoredStop('waypoint', stop))
    .filter((stop): stop is NonNullable<typeof stop> => Boolean(stop));

  return {
    version: 1,
    stops: [pickup, ...intermediateStops, dropoff],
  };
}

export function getRequestRouteSnapshot(quoteBreakdown: unknown): RequestRouteSnapshot | null {
  if (!isRecord(quoteBreakdown)) return null;

  const routeStops = quoteBreakdown.routeStops;
  if (!isRecord(routeStops)) return null;
  if (routeStops.version !== 1 || !Array.isArray(routeStops.stops)) return null;

  const stops = routeStops.stops
    .map((stop) => readStoredStop(stop))
    .filter((stop): stop is NonNullable<typeof stop> => Boolean(stop));

  if (stops.length < 2) {
    return null;
  }

  return {
    version: 1,
    stops,
  };
}

export function getRequestRouteStops(
  quoteBreakdown: unknown,
  fallback?: {
    pickupAddress?: string | null;
    dropoffAddress?: string | null;
  },
): RequestRouteStop[] {
  const snapshot = getRequestRouteSnapshot(quoteBreakdown);
  if (snapshot) {
    return snapshot.stops;
  }

  const pickupAddress = normalizeString(fallback?.pickupAddress);
  const dropoffAddress = normalizeString(fallback?.dropoffAddress);
  const stops: RequestRouteStop[] = [];

  if (pickupAddress) {
    stops.push({
      type: 'pickup',
      address: pickupAddress,
    });
  }

  if (dropoffAddress) {
    stops.push({
      type: 'dropoff',
      address: dropoffAddress,
    });
  }

  return stops;
}

export function hasRouteStopCoordinates(
  stop: RequestRouteStop,
): stop is RequestRouteStop & { lat: number; lng: number } {
  return Number.isFinite(stop.lat) && Number.isFinite(stop.lng);
}

export function getChargeableStopCount(totalRouteStops: number): number {
  return Math.max(1, Math.round(Math.max(2, totalRouteStops)) - 1);
}

export function getRequestRouteStopLabel(stop: RequestRouteStop, index: number): string {
  const explicitLabel = normalizeOptionalString(stop.label);
  if (explicitLabel) return explicitLabel;
  if (stop.type === 'pickup') return `Pickup ${index + 1}`;
  if (stop.type === 'dropoff') return 'Final Dropoff';
  return `Stop ${index + 1}`;
}

export function calculateRequestRouteMiles(stops: Array<{ lat: number; lng: number }>): number {
  if (stops.length < 2) return 0;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  let totalMiles = 0;

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const current = stops[index];
    const earthRadiusMiles = 3959;
    const dLat = toRadians(current.lat - previous.lat);
    const dLng = toRadians(current.lng - previous.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(previous.lat)) *
        Math.cos(toRadians(current.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    totalMiles += 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  return Math.max(0.1, totalMiles);
}
