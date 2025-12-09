import { OtwDriverId } from "./otwIds";
import { OtwDriverProfile } from "./otwTypes";
import { newDriverId } from "./otwIds";
import { DriverCurrentStatus, DriverTier } from "./otwEnums";
import { ok, err, Result } from "./otwResult";

/**
 * In-memory driver store.
 * TODO: Replace with proper persistence (Prisma, etc.).
 */
const driverStore: OtwDriverProfile[] = [];
const defaultTier: DriverTier = "BRONZE";

export const registerDriver = (args: {
  displayName: string;
  baseZone: string;
}): Result<OtwDriverProfile> => {
  if (!args.displayName.trim()) {
    return err("Driver displayName is required.");
  }
  const driverId: OtwDriverId = newDriverId();
  const now = new Date().toISOString();
  const profile: OtwDriverProfile = {
    driverId,
    displayName: args.displayName.trim(),
    baseZone: args.baseZone || "GENERAL",
    tier: defaultTier,
    status: "OFFLINE",
    completedJobs: 0,
    cancelledJobs: 0,
    avgRating: 0,
    lastActiveAt: now,
    franchiseScore: 0,
    franchiseRank: "NOT_ELIGIBLE",
    franchiseEligible: false,
    franchiseLastEvaluatedAt: now,
  };
  driverStore.push(profile);
  return ok(profile);
};

export const getDriverById = (
  driverId: OtwDriverId
): OtwDriverProfile | null => {
  return driverStore.find((d) => d.driverId === driverId) || null;
};

export const listDrivers = (): OtwDriverProfile[] => [...driverStore];

// Additional helpers for matching engine
export const getAllDrivers = (): OtwDriverProfile[] => listDrivers();

export const getAvailableDrivers = (): OtwDriverProfile[] =>
  driverStore.filter((d) => d.status !== "OFFLINE");

export const setDriverStatus = (
  driverId: OtwDriverId,
  status: DriverCurrentStatus
): Result<OtwDriverProfile> => {
  const driver = driverStore.find((d) => d.driverId === driverId);
  if (!driver) return err("Driver not found.");
  driver.status = status;
  driver.lastActiveAt = new Date().toISOString();
  return ok(driver);
};

export const recordDriverCompletedJob = (
  driverId: OtwDriverId
): Result<OtwDriverProfile> => {
  const driver = driverStore.find((d) => d.driverId === driverId);
  if (!driver) return err("Driver not found.");
  driver.completedJobs += 1;
  driver.lastActiveAt = new Date().toISOString();
  return ok(driver);
};

export const recordDriverCancelledJob = (
  driverId: OtwDriverId
): Result<OtwDriverProfile> => {
  const driver = driverStore.find((d) => d.driverId === driverId);
  if (!driver) return err("Driver not found.");
  driver.cancelledJobs += 1;
  driver.lastActiveAt = new Date().toISOString();
  return ok(driver);
};

// Seed some mock drivers if store is empty (for early development/testing)
if (driverStore.length === 0) {
  const isoNow = new Date().toISOString();
  driverStore.push(
    {
      driverId: "DRIVER-1",
      displayName: "Marcus – North OTW",
      baseZone: "North Fort Wayne",
      tier: "SILVER", // maps to PRO-equivalent
      status: "IDLE",
      completedJobs: 42,
      cancelledJobs: 2,
      avgRating: 4.8,
      lastActiveAt: isoNow,
    },
    {
      driverId: "DRIVER-2",
      displayName: "Keisha – South Haul",
      baseZone: "South Decatur Rd",
      tier: "PLATINUM", // maps to ELITE-equivalent
      status: "ON_JOB",
      completedJobs: 120,
      cancelledJobs: 4,
      avgRating: 4.9,
      lastActiveAt: isoNow,
    },
    {
      driverId: "DRIVER-3",
      displayName: "Tay – City Floater",
      baseZone: "Central Fort Wayne",
      tier: "BRONZE", // maps to STANDARD-equivalent
      status: "IDLE",
      completedJobs: 18,
      cancelledJobs: 1,
      avgRating: 4.5,
      lastActiveAt: isoNow,
    }
  );
}
