/**
 * Geocoding utilities for address search and validation
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */

type ServiceArea = {
  name: string;
  queryBias: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  viewbox: string;
  locationAliases: string[];
};

const DEFAULT_SEARCH_LIMIT = 5;

const SERVICE_AREAS: ServiceArea[] = [
  {
    name: 'Chicago',
    queryBias: 'Chicago, IL',
    latitude: 41.8781,
    longitude: -87.6298,
    radiusMiles: 30,
    viewbox: '-88.15,42.05,-87.45,41.55',
    locationAliases: [
      'chicago',
      'chicago il',
      'chi town',
      'downtown chicago',
      'the loop',
      'loop',
      'west loop',
      'south loop',
      'river north',
      'streeterville',
      'lincoln park',
      'wicker park',
      'logan square',
      'lakeview',
      'old town',
      'uptown',
      'rogers park',
      'hyde park',
      'bronzeville',
      'bridgeport',
      'pilsen',
      'chinatown',
      'south side',
      'west side',
      'north side',
      'near north side',
      'near west side',
      'englewood',
    ],
  },
  {
    name: 'Fort Wayne',
    queryBias: 'Fort Wayne, IN',
    latitude: 41.0793,
    longitude: -85.1394,
    radiusMiles: 25,
    viewbox: '-85.5,41.3,-84.8,40.8',
    locationAliases: [
      'fort wayne',
      'fort wayne in',
      'downtown fort wayne',
      'new haven in',
      'allen county',
      'north side fort wayne',
      'south side fort wayne',
      'west side fort wayne',
      'east side fort wayne',
    ],
  },
];

function getAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}

function getInternalApiUrl(pathname: string): URL {
  return new URL(pathname, getAppOrigin());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

function getRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export interface GeocodedAddress {
  formattedAddress: string;
  placeName?: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  serviceAreaName: string;
  distanceFromServiceArea: number;
  distanceFromFortWayne: number;
  isWithinServiceArea: boolean;
}

export function formatAddressLines(address: GeocodedAddress) {
  const placeName = address.placeName?.trim();
  const street = address.streetAddress?.trim();
  const isPrimaryPlaceName = Boolean(placeName);
  const primary = placeName || street || address.formattedAddress || '';

  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  const cityStateZip = cityState + (address.zipCode ? ` ${address.zipCode}` : '');

  const secondaryParts: string[] = [];
  if (
    street &&
    primary &&
    (isPrimaryPlaceName || street.toLowerCase() !== primary.toLowerCase())
  ) {
    secondaryParts.push(street);
  }
  if (cityStateZip) {
    secondaryParts.push(cityStateZip);
  }

  return {
    primary,
    secondary: secondaryParts.join(', '),
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function normalizeQuery(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getServiceAreasForQuery(query: string): ServiceArea[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return SERVICE_AREAS;

  const matchedAreas = SERVICE_AREAS.filter((area) =>
    area.locationAliases.some((alias) => normalized.includes(alias))
  );

  return matchedAreas.length > 0 ? matchedAreas : SERVICE_AREAS;
}

function getClosestServiceArea(latitude: number, longitude: number): {
  area: ServiceArea;
  distanceMiles: number;
} {
  let closestArea = SERVICE_AREAS[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const area of SERVICE_AREAS) {
    const distance = calculateDistance(area.latitude, area.longitude, latitude, longitude);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestArea = area;
    }
  }

  return {
    area: closestArea,
    distanceMiles: closestDistance,
  };
}

function getSearchQueries(query: string): Array<{ searchText: string; area?: ServiceArea }> {
  const trimmed = query.trim();
  const areas = getServiceAreasForQuery(trimmed);
  const normalized = normalizeQuery(trimmed);

  const queries: Array<{ searchText: string; area?: ServiceArea }> = [{ searchText: trimmed }];

  for (const area of areas) {
    const alreadyScoped =
      normalized.includes(normalizeQuery(area.name)) ||
      normalized.includes(normalizeQuery(area.queryBias));
    if (alreadyScoped) continue;
    queries.push({ searchText: `${trimmed}, ${area.queryBias}`, area });
  }

  return queries;
}

/**
 * Search for addresses using OpenStreetMap Nominatim API
 * with service-area-aware location name support.
 */
export async function searchAddress(
  query: string
): Promise<GeocodedAddress[]> {
  if (!query || query.trim().length < 3) {
    return [];
  }

  try {
    const dedupedResults = new Map<string, GeocodedAddress>();
    const searchQueries = getSearchQueries(query);

    for (const search of searchQueries) {
      const url = getInternalApiUrl('/api/geocoding/search');
      url.searchParams.append('q', search.searchText);
      url.searchParams.append('format', 'json');
      url.searchParams.append('addressdetails', '1');
      url.searchParams.append('namedetails', '1');
      url.searchParams.append('limit', String(DEFAULT_SEARCH_LIMIT));
      url.searchParams.append('countrycodes', 'us');
      if (search.area) {
        url.searchParams.append('viewbox', search.area.viewbox);
        url.searchParams.append('bounded', '0');
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) continue;

      for (const value of payload) {
        if (!isRecord(value)) continue;

        const latText = getString(value.lat);
        const lngText = getString(value.lon);
        if (!latText || !lngText) continue;

        const lat = Number.parseFloat(latText);
        const lng = Number.parseFloat(lngText);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const nearest = getClosestServiceArea(lat, lng);
        const isWithinServiceArea = nearest.distanceMiles <= nearest.area.radiusMiles;
        if (!isWithinServiceArea) continue;

        const address = getRecord(value.address);
        const namedetails = isRecord(value.namedetails) ? value.namedetails : undefined;
        const streetNumber = getString(address.house_number);
        const street = getString(address.road);
        const streetAddress = `${streetNumber} ${street}`.trim();
        const placeName =
          (namedetails && getString(namedetails.name)) ||
          getString(value.name) ||
          getString(address.building) ||
          getString(address.amenity) ||
          getString(address.shop) ||
          getString(address.tourism) ||
          getString(address.leisure) ||
          getString(address.office) ||
          getString(address.historic) ||
          getString(address.craft) ||
          getString(address.man_made);

        const roundedDistance = Math.round(nearest.distanceMiles * 10) / 10;
        const formattedAddress = getString(value.display_name);
        const dedupeKey = `${formattedAddress.toLowerCase()}|${lat.toFixed(6)}|${lng.toFixed(6)}`;
        dedupedResults.set(dedupeKey, {
          formattedAddress,
          placeName: placeName || undefined,
          streetAddress,
          city:
            getString(address.city) ||
            getString(address.town) ||
            getString(address.village),
          state: getString(address.state),
          zipCode: getString(address.postcode),
          latitude: lat,
          longitude: lng,
          serviceAreaName: nearest.area.name,
          distanceFromServiceArea: roundedDistance,
          distanceFromFortWayne: roundedDistance,
          isWithinServiceArea: true,
        });
      }

      if (dedupedResults.size >= DEFAULT_SEARCH_LIMIT) {
        break;
      }
    }

    return Array.from(dedupedResults.values())
      .sort((a, b) => a.distanceFromServiceArea - b.distanceFromServiceArea)
      .slice(0, DEFAULT_SEARCH_LIMIT);
  } catch (error) {
    console.error('Address search error:', error);
    throw new Error('Failed to search address. Please try again.');
  }
}

/**
 * Geocode a single address and validate it's within service area
 */
export async function validateAddress(
  address: string
): Promise<GeocodedAddress | null> {
  const results = await searchAddress(address);
  return results.length > 0 ? results[0] : null;
}

export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number
): Promise<GeocodedAddress | null> {
  try {
    // Use internal API proxy to avoid CORS issues
    const url = getInternalApiUrl('/api/geocoding/reverse');
    url.searchParams.append('format', 'json');
    url.searchParams.append('lat', String(latitude));
    url.searchParams.append('lon', String(longitude));
    url.searchParams.append('addressdetails', '1');
    url.searchParams.append('namedetails', '1');
    url.searchParams.append('zoom', '18');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    if (payload == null || typeof payload !== 'object') return null;
    const record = payload as Record<string, unknown>;
    const displayName = typeof record.display_name === 'string' ? record.display_name : '';

    const nearest = getClosestServiceArea(latitude, longitude);
    const isWithin = nearest.distanceMiles <= nearest.area.radiusMiles;
    if (!isWithin) return null;

    const address =
      record.address && typeof record.address === 'object'
        ? (record.address as Record<string, unknown>)
        : {};

    const houseNumber = typeof address.house_number === 'string' ? address.house_number : '';
    const road = typeof address.road === 'string' ? address.road : '';
    const streetAddress = `${houseNumber} ${road}`.trim();

    const namedetails =
      record.namedetails && typeof record.namedetails === 'object'
        ? (record.namedetails as Record<string, unknown>)
        : {};
    const placeName = typeof namedetails.name === 'string' ? namedetails.name : undefined;

    const city =
      (typeof address.city === 'string' && address.city) ||
      (typeof address.town === 'string' && address.town) ||
      (typeof address.village === 'string' && address.village) ||
      '';
    const state = typeof address.state === 'string' ? address.state : '';
    const zipCode = typeof address.postcode === 'string' ? address.postcode : '';

    return {
      formattedAddress: displayName,
      placeName,
      streetAddress,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      serviceAreaName: nearest.area.name,
      distanceFromServiceArea: Math.round(nearest.distanceMiles * 10) / 10,
      distanceFromFortWayne: Math.round(nearest.distanceMiles * 10) / 10,
      isWithinServiceArea: true,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Check if coordinates are within service area
 */
export function isWithinServiceArea(
  latitude: number,
  longitude: number
): boolean {
  const nearest = getClosestServiceArea(latitude, longitude);
  return nearest.distanceMiles <= nearest.area.radiusMiles;
}
