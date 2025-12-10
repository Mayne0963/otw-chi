import type { OtwCityId, OtwZoneId } from "./otwIds";

export interface OtwCity {
  cityId: OtwCityId;
  name: string;
}

export interface OtwZone {
  zoneId: OtwZoneId;
  cityId: OtwCityId;
  name: string;
  shortCode: string;
  isActive: boolean;
}

const cities: OtwCity[] = [
  { cityId: "city_ftw" as OtwCityId, name: "Fort Wayne, IN" },
];

const zones: OtwZone[] = [
  {
    zoneId: "zone_ftw_north" as OtwZoneId,
    cityId: "city_ftw" as OtwCityId,
    name: "North Fort Wayne",
    shortCode: "NORTH",
    isActive: true,
  },
  {
    zoneId: "zone_ftw_south" as OtwZoneId,
    cityId: "city_ftw" as OtwCityId,
    name: "South Fort Wayne",
    shortCode: "SOUTH",
    isActive: true,
  },
  {
    zoneId: "zone_ftw_central" as OtwZoneId,
    cityId: "city_ftw" as OtwCityId,
    name: "Central Fort Wayne",
    shortCode: "CENTRAL",
    isActive: true,
  },
  {
    zoneId: "zone_ftw_wide" as OtwZoneId,
    cityId: "city_ftw" as OtwCityId,
    name: "Greater Fort Wayne / County",
    shortCode: "WIDE",
    isActive: true,
  },
];

export const listCities = (): OtwCity[] => [...cities];
export const listZones = (): OtwZone[] => [...zones];
export const listZonesByCity = (cityId: OtwCityId): OtwZone[] => zones.filter((z) => z.cityId === cityId && z.isActive);
export const getZoneById = (zoneId: OtwZoneId): OtwZone | undefined => zones.find((z) => z.zoneId === zoneId);
