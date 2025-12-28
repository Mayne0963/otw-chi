/**
 * Geocoding utilities for address search and validation
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */

// Fort Wayne, IN coordinates
const FORT_WAYNE_LAT = 41.0793;
const FORT_WAYNE_LNG = -85.1394;
const SERVICE_RADIUS_MILES = 25;

export interface GeocodedAddress {
  formattedAddress: string;
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
  const displayName = address.formattedAddress?.split(',')[0]?.trim();
  const primary =
    displayName || address.streetAddress || address.formattedAddress || '';

  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  const cityStateZip = cityState + (address.zipCode ? ` ${address.zipCode}` : '');

  const secondaryParts: string[] = [];
  const street = address.streetAddress?.trim();
  if (street && primary && street.toLowerCase() !== primary.toLowerCase()) {
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

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.append('q', searchQuery);
    url.searchParams.append('format', 'json');
    url.searchParams.append('addressdetails', '1');
    url.searchParams.append('limit', '5');
    url.searchParams.append('countrycodes', 'us');
    // Bias results towards Fort Wayne area
    url.searchParams.append('viewbox', '-85.5,41.3,-84.8,40.8');
    url.searchParams.append('bounded', '0');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'OTW-Delivery-App',
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const results = await response.json();

    return results
      .map((result: any) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const distance = calculateDistance(
          FORT_WAYNE_LAT,
          FORT_WAYNE_LNG,
          lat,
          lng
        );

        const address = result.address || {};
        const streetNumber = address.house_number || '';
        const street = address.road || '';
        const streetAddress = `${streetNumber} ${street}`.trim();

        return {
          formattedAddress: result.display_name,
          streetAddress,
          city: address.city || address.town || address.village || '',
          state: address.state || '',
          zipCode: address.postcode || '',
          latitude: lat,
          longitude: lng,
          distanceFromFortWayne: Math.round(distance * 10) / 10,
          isWithinServiceArea: distance <= SERVICE_RADIUS_MILES,
        };
      })
      .filter((addr: GeocodedAddress) => addr.isWithinServiceArea);
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
