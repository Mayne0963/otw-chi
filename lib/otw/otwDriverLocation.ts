import { OtwLocation } from "./otwTypes";

export interface OtwDriverLocation {
  driverId: string;
  location: OtwLocation;
  updatedAt: string; // ISO
  currentRequestId?: string;
}

const driverLocationStore: OtwDriverLocation[] = [];

export const upsertDriverLocation = (
  driverId: string,
  location: OtwLocation,
  currentRequestId?: string
): OtwDriverLocation => {
  const existing = driverLocationStore.find((d) => d.driverId === driverId);

  const payload: OtwDriverLocation = {
    driverId,
    location,
    updatedAt: new Date().toISOString(),
    currentRequestId,
  };

  if (!existing) {
    driverLocationStore.push(payload);
    return payload;
  }

  existing.location = payload.location;
  existing.updatedAt = payload.updatedAt;
  existing.currentRequestId = currentRequestId || existing.currentRequestId;
  return existing;
};

export const getDriverLocation = (
  driverId: string
): OtwDriverLocation | undefined => {
  return driverLocationStore.find((d) => d.driverId === driverId);
};

export const getAllDriverLocations = (): OtwDriverLocation[] => {
  return driverLocationStore;
};

export const getDriverLocationsForRequest = (
  requestId: string
): OtwDriverLocation[] => {
  return driverLocationStore.filter((d) => d.currentRequestId === requestId);
};
