/**
 * Geocoding utilities for address search and validation
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */

// Fort Wayne, IN coordinates
const FORT_WAYNE_LAT = 41.0793;
const FORT_WAYNE_LNG = -85.1394;
const SERVICE_RADIUS_MILES = 25;

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

/**
 * Search for addresses using OpenStreetMap Nominatim API
 * Biased towards Fort Wayne area
 */
export async function searchAddress(
  query: string
): Promise<GeocodedAddress[]> {
  if (!query || query.trim().length < 3) {
    return [];
  }

  try {
    // Add Fort Wayne, IN bias to the search
    const searchQuery = query.includes('Fort Wayne')
      ? query
      : `${query}, Fort Wayne, IN`;

    // Use internal API proxy to avoid CORS issues
    const url = getInternalApiUrl('/api/geocoding/search');
    url.searchParams.append('q', searchQuery);
    url.searchParams.append('format', 'json');
    url.searchParams.append('addressdetails', '1');
    url.searchParams.append('namedetails', '1');
    url.searchParams.append('limit', '5');
    url.searchParams.append('countrycodes', 'us');
    // Bias results towards Fort Wayne area
    url.searchParams.append('viewbox', '-85.5,41.3,-84.8,40.8');
    url.searchParams.append('bounded', '0');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) return [];

    return payload
      .map((value): GeocodedAddress | null => {
        if (!isRecord(value)) return null;

        const latText = getString(value.lat);
        const lngText = getString(value.lon);
        if (!latText || !lngText) return null;

        const lat = Number.parseFloat(latText);
        const lng = Number.parseFloat(lngText);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const distance = calculateDistance(
          FORT_WAYNE_LAT,
          FORT_WAYNE_LNG,
          lat,
          lng
        );

        const address = getRecord(value.address);
        const namedetails = isRecord(value.namedetails)
          ? value.namedetails
          : undefined;

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

        return {
          formattedAddress: getString(value.display_name),
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
          distanceFromFortWayne: Math.round(distance * 10) / 10,
          isWithinServiceArea: distance <= SERVICE_RADIUS_MILES,
        };
      })
      .filter((addr): addr is GeocodedAddress => Boolean(addr?.isWithinServiceArea));
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

    const distance = calculateDistance(
      FORT_WAYNE_LAT,
      FORT_WAYNE_LNG,
      latitude,
      longitude
    );
    const isWithin = distance <= SERVICE_RADIUS_MILES;
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
      distanceFromFortWayne: Math.round(distance * 10) / 10,
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
  const distance = calculateDistance(
    FORT_WAYNE_LAT,
    FORT_WAYNE_LNG,
    latitude,
    longitude
  );
  return distance <= SERVICE_RADIUS_MILES;
}
