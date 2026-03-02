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

type FeaturedLocation = {
  placeName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  aliases: string[];
};

const DEFAULT_SEARCH_LIMIT = 8;

const SERVICE_AREAS: ServiceArea[] = [
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
      'downtown',
      'the landing',
      'west central',
      'southwood park',
      'northside',
      'north side fort wayne',
      'south side fort wayne',
      'west side fort wayne',
      'east side fort wayne',
      'new haven',
      'new haven in',
      'allen county',
      'parkview field',
      'electric works',
      'promenade park',
      'headwaters park',
      'science central',
      'fort wayne childrens zoo',
      'childrens zoo',
      'glenbrook square',
      'jefferson pointe',
      'allen county war memorial coliseum',
      'war memorial coliseum',
      'memorial coliseum',
      'parkview regional medical center',
      'parkview regional',
      'lutheran hospital',
      'dupont hospital',
      'purdue fort wayne',
      'pfw',
      'ipfw',
      'indiana tech',
      'university of saint francis',
      'saint francis fort wayne',
      'franke park',
      'foster park',
      'foellinger theatre',
      'foellinger freimann botanical conservatory',
      'botanical conservatory',
      'grand wayne center',
      'embassy theatre',
      'coliseum boulevard',
      'georgetown',
      'canterbury',
      'arlington park',
      'southwest fort wayne',
      'northeast fort wayne',
      'northwest fort wayne',
      'southeast fort wayne',
      'fort wayne international airport',
      'fwa airport',
      'fwa',
      'general motors fort wayne assembly',
      'gm fort wayne assembly',
      'fort wayne assembly',
      'sweetwater',
      'sweetwater sound',
      'amazon fulfillment center',
      'amazon fort wayne',
      'steel dynamics',
      'sdi fort wayne',
      'lima road',
      'coldwater road',
      'maplecrest road',
      'illinois road',
      'bluffton road',
      'jefferson boulevard',
      'dupont road',
      'st joe center road',
      'georgetown square',
      'coventry',
      'coventry plaza',
      'northcrest',
      'science central',
      'allen county public library',
      'public library main',
      'the clyde theatre',
      'clyde theatre',
      'lutheran downtown hospital',
      'st joseph hospital',
      'franciscan center',
      'airport expressway',
      'gateway plaza',
      'northcrest shopping center',
      'canterbury green',
      'redeemer radio area',
      'woodland plaza',
      'north anthony',
      'waynedale',
      'Aboite',
      'aboite',
      'new haven high school',
      'snider high school',
      'northrop high school',
      'carroll high school',
      'homestead high school',
      'south side high school',
      'northcrest',
      'coliseum crossing',
      'apple glen',
    ],
  },
];

const FEATURED_FORT_WAYNE_LOCATIONS: FeaturedLocation[] = [
  {
    placeName: 'Parkview Field',
    streetAddress: '1301 Ewing St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0676,
    longitude: -85.1402,
    aliases: ['tin caps stadium', 'baseball stadium'],
  },
  {
    placeName: 'Electric Works',
    streetAddress: '1620 Broadway',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0711,
    longitude: -85.1537,
    aliases: ['union street market', 'west central'],
  },
  {
    placeName: 'Promenade Park',
    streetAddress: '202 W Superior St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0818,
    longitude: -85.1438,
    aliases: ['riverfront'],
  },
  {
    placeName: 'Headwaters Park',
    streetAddress: '333 S Clinton St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0831,
    longitude: -85.1385,
    aliases: ['festival plaza'],
  },
  {
    placeName: "Fort Wayne Children's Zoo",
    streetAddress: '3411 Sherman Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46808',
    latitude: 41.1182,
    longitude: -85.1651,
    aliases: ['childrens zoo', 'zoo'],
  },
  {
    placeName: 'Glenbrook Square',
    streetAddress: '4201 Coldwater Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.1165,
    longitude: -85.1389,
    aliases: ['glenbrook mall', 'mall'],
  },
  {
    placeName: 'Jefferson Pointe',
    streetAddress: '4130 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.072,
    longitude: -85.1954,
    aliases: ['shopping center'],
  },
  {
    placeName: 'Allen County War Memorial Coliseum',
    streetAddress: '4000 Parnell Ave',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.1096,
    longitude: -85.1118,
    aliases: ['war memorial coliseum', 'memorial coliseum', 'coliseum'],
  },
  {
    placeName: 'Parkview Regional Medical Center',
    streetAddress: '11109 Parkview Plaza Dr',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46845',
    latitude: 41.1858,
    longitude: -85.1005,
    aliases: ['parkview regional', 'hospital'],
  },
  {
    placeName: 'Lutheran Hospital',
    streetAddress: '7950 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0607,
    longitude: -85.2466,
    aliases: ['lutheran health network', 'hospital'],
  },
  {
    placeName: 'Purdue Fort Wayne',
    streetAddress: '2101 E Coliseum Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.1183,
    longitude: -85.1116,
    aliases: ['pfw', 'ipfw', 'campus', 'college'],
  },
  {
    placeName: 'Grand Wayne Convention Center',
    streetAddress: '120 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.079,
    longitude: -85.1415,
    aliases: ['grand wayne center', 'convention center', 'embassy theatre'],
  },
  {
    placeName: 'Fort Wayne International Airport',
    streetAddress: '3801 W Ferguson Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46809',
    latitude: 40.9785,
    longitude: -85.1951,
    aliases: ['fwa', 'airport', 'terminal'],
  },
  {
    placeName: 'General Motors Fort Wayne Assembly',
    streetAddress: '12200 Lafayette Center Rd',
    city: 'Roanoke',
    state: 'IN',
    zipCode: '46783',
    latitude: 40.9914,
    longitude: -85.3129,
    aliases: ['gm plant', 'assembly plant', 'silverado plant', 'job site'],
  },
  {
    placeName: 'Amazon Fulfillment Center',
    streetAddress: '9798 Smith Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46809',
    latitude: 40.9975,
    longitude: -85.1902,
    aliases: ['amazon warehouse', 'amazon job site', 'fulfillment center'],
  },
  {
    placeName: 'Sweetwater',
    streetAddress: '5501 US Hwy 30 W',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46818',
    latitude: 41.0626,
    longitude: -85.2147,
    aliases: ['sweetwater sound', 'music store', 'distribution'],
  },
  {
    placeName: 'Steel Dynamics',
    streetAddress: '7575 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0618,
    longitude: -85.2434,
    aliases: ['sdi', 'steel plant', 'industrial site'],
  },
  {
    placeName: 'Dupont Hospital',
    streetAddress: '2520 E Dupont Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46825',
    latitude: 41.1784,
    longitude: -85.1066,
    aliases: ['dupont', 'hospital', 'medical center'],
  },
  {
    placeName: 'Lutheran Downtown Hospital',
    streetAddress: '702 Van Buren St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0756,
    longitude: -85.1455,
    aliases: ['downtown hospital', 'lutheran downtown'],
  },
  {
    placeName: 'Indiana Tech',
    streetAddress: '1600 E Washington Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46803',
    latitude: 41.0825,
    longitude: -85.1184,
    aliases: ['college', 'campus', 'warriors'],
  },
  {
    placeName: 'University of Saint Francis',
    streetAddress: '2701 Spring St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46808',
    latitude: 41.1098,
    longitude: -85.1763,
    aliases: ['saint francis', 'usf'],
  },
  {
    placeName: 'Science Central',
    streetAddress: '1950 N Clinton St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.0954,
    longitude: -85.1374,
    aliases: ['science museum', 'museum'],
  },
  {
    placeName: 'Allen County Public Library Main',
    streetAddress: '900 Library Plaza',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.077,
    longitude: -85.1402,
    aliases: ['acpl', 'main library', 'public library'],
  },
  {
    placeName: 'Embassy Theatre',
    streetAddress: '125 W Jefferson Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0792,
    longitude: -85.1419,
    aliases: ['embassy', 'theatre', 'downtown theater'],
  },
  {
    placeName: 'Foellinger-Freimann Botanical Conservatory',
    streetAddress: '1100 S Calhoun St',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46802',
    latitude: 41.0775,
    longitude: -85.1382,
    aliases: ['botanical conservatory', 'conservatory'],
  },
  {
    placeName: 'The Clyde Theatre',
    streetAddress: '1808 Bluffton Rd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46809',
    latitude: 41.0576,
    longitude: -85.1633,
    aliases: ['clyde theatre', 'club room at the clyde'],
  },
  {
    placeName: 'Georgetown Square',
    streetAddress: '6511 E State Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46815',
    latitude: 41.1028,
    longitude: -85.0544,
    aliases: ['georgetown', 'shopping plaza'],
  },
  {
    placeName: 'Coventry Plaza',
    streetAddress: '5735 Falls Dr',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46804',
    latitude: 41.0568,
    longitude: -85.2173,
    aliases: ['coventry', 'southwest shopping'],
  },
  {
    placeName: 'Northcrest Shopping Center',
    streetAddress: '1005 E Coliseum Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46805',
    latitude: 41.1189,
    longitude: -85.1275,
    aliases: ['northcrest', 'shopping center'],
  },
  {
    placeName: 'Canterbury Green',
    streetAddress: '2727 Canterbury Blvd',
    city: 'Fort Wayne',
    state: 'IN',
    zipCode: '46835',
    latitude: 41.1041,
    longitude: -85.0635,
    aliases: ['canterbury', 'apartment complex'],
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

function toFeaturedAddress(location: FeaturedLocation): GeocodedAddress {
  const nearest = getClosestServiceArea(location.latitude, location.longitude);
  const roundedDistance = Math.round(nearest.distanceMiles * 10) / 10;

  return {
    formattedAddress: `${location.placeName}, ${location.streetAddress}, ${location.city}, ${location.state} ${location.zipCode}`,
    placeName: location.placeName,
    streetAddress: location.streetAddress,
    city: location.city,
    state: location.state,
    zipCode: location.zipCode,
    latitude: location.latitude,
    longitude: location.longitude,
    serviceAreaName: nearest.area.name,
    distanceFromServiceArea: roundedDistance,
    distanceFromFortWayne: roundedDistance,
    isWithinServiceArea: true,
  };
}

function getFeaturedLocationSuggestions(query: string): GeocodedAddress[] {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return FEATURED_FORT_WAYNE_LOCATIONS.slice(0, DEFAULT_SEARCH_LIMIT).map(toFeaturedAddress);
  }

  const filtered = FEATURED_FORT_WAYNE_LOCATIONS.filter((location) => {
    const haystack = normalizeQuery(
      `${location.placeName} ${location.streetAddress} ${location.city} ${location.state} ${location.aliases.join(' ')}`
    );
    return haystack.includes(normalized);
  });

  const matches = (filtered.length > 0 ? filtered : FEATURED_FORT_WAYNE_LOCATIONS).slice(
    0,
    DEFAULT_SEARCH_LIMIT
  );
  return matches.map(toFeaturedAddress);
}

/**
 * Search for addresses using OpenStreetMap Nominatim API
 * with service-area-aware location name support.
 */
export async function searchAddress(
  query: string
): Promise<GeocodedAddress[]> {
  const trimmedQuery = query.trim();
  const featuredSuggestions = getFeaturedLocationSuggestions(trimmedQuery);
  if (!trimmedQuery) return featuredSuggestions;

  try {
    const dedupedResults = new Map<string, GeocodedAddress>();
    const searchQueries = getSearchQueries(trimmedQuery);

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

    const resolvedResults = Array.from(dedupedResults.values())
      .sort((a, b) => a.distanceFromServiceArea - b.distanceFromServiceArea)
      .slice(0, DEFAULT_SEARCH_LIMIT);
    if (resolvedResults.length >= DEFAULT_SEARCH_LIMIT) {
      return resolvedResults;
    }

    const fallbackRemainder = featuredSuggestions.filter((featured) => {
      const featuredKey = `${featured.formattedAddress.toLowerCase()}|${featured.latitude.toFixed(6)}|${featured.longitude.toFixed(6)}`;
      return !dedupedResults.has(featuredKey);
    });

    return [...resolvedResults, ...fallbackRemainder].slice(0, DEFAULT_SEARCH_LIMIT);
  } catch (error) {
    console.error('Address search error:', error);
    return featuredSuggestions;
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
