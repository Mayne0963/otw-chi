import { listDrivers } from "./otwDrivers";
import { listAllRequests } from "./otwRequests";
import { listAllNipWallets } from "./otwNip";
import { listAllMemberships } from "./otwMembership";
import { listZones } from "./otwZones";
import { OtwDriverProfile, OtwRequest } from "./otwTypes";

export interface AdminDriverSnapshot {
  driverId: string;
  displayName: string;
  completedJobs: number;
  cancelledJobs: number;
  avgRating: number;
  franchiseScore: number;
  franchiseRank: string;
  franchiseEligible: boolean;
}

export interface ZoneCoverageSnapshot {
  zoneId: string;
  zoneName: string;
  cityName: string;
  activeDrivers: number;
  openRequests: number;
  completedToday: number;
}

export interface AdminOverviewSnapshot {
  generatedAt: string;

  totalDrivers: number;
  totalRequests: number;
  openRequests: number;
  completedRequests: number;
  pendingRequests: number;

  totalNipWallets: number;
  totalNipInCirculation: number; // sum of balances
  totalNipEarnedAllTime: number; // sum of totalEarned

  topDriversByFranchise: AdminDriverSnapshot[];
  zones?: ZoneCoverageSnapshot[];
}

const isOpenStatus = (status: string | undefined) =>
  status === "PENDING" || status === "MATCHED" || status === "ACCEPTED";
const isCompletedStatus = (status: string | undefined) => status === "COMPLETED";

export const getAdminOverviewSnapshot = (): AdminOverviewSnapshot => {
  const drivers: OtwDriverProfile[] = listDrivers();
  const requests: OtwRequest[] = listAllRequests();
  const wallets = listAllNipWallets();

  const totalDrivers = drivers.length;
  const totalRequests = requests.length;

  let openRequests = 0;
  let completedRequests = 0;
  let pendingRequests = 0;

  for (const r of requests) {
    if (isCompletedStatus(r.status)) {
      completedRequests++;
    } else if (isOpenStatus(r.status)) {
      openRequests++;
    } else {
      pendingRequests++;
    }
  }

  const totalNipWallets = wallets.length;
  const totalNipInCirculation = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
  const totalNipEarnedAllTime = wallets.reduce((sum, w) => sum + (w.totalEarned || 0), 0);

  const driverSnapshots: AdminDriverSnapshot[] = drivers.map((d) => ({
    driverId: d.driverId,
    displayName: d.displayName,
    completedJobs: d.completedJobs ?? 0,
    cancelledJobs: d.cancelledJobs ?? 0,
    avgRating: d.avgRating ?? 0,
    franchiseScore: d.franchiseScore ?? 0,
    franchiseRank: (d.franchiseRank as string) ?? "NOT_ELIGIBLE",
    franchiseEligible: d.franchiseEligible ?? false,
  }));

  const topDriversByFranchise = driverSnapshots
    .slice()
    .sort((a, b) => (b.franchiseScore || 0) - (a.franchiseScore || 0))
    .slice(0, 10);

  // Build zone coverage snapshot
  const allZones = listZones();
  const zones = allZones.map((z) => {
    const activeDrivers = drivers.filter(
      (d) => d.primaryZoneId === z.zoneId || (d.allowedZoneIds && d.allowedZoneIds.includes(z.zoneId))
    ).length;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const openRequests = requests.filter(
      (r) => r.zoneId === z.zoneId && (r.status === "PENDING" || r.status === "MATCHED" || r.status === "ACCEPTED")
    ).length;
    const completedToday = requests.filter(
      (r) =>
        r.zoneId === z.zoneId &&
        r.status === "COMPLETED" &&
        r.completedAt &&
        new Date(r.completedAt) >= startOfDay
    ).length;

    return {
      zoneId: z.zoneId,
      zoneName: z.name,
      cityName: z.cityId, // approximate mapping for mock
      activeDrivers,
      openRequests,
      completedToday,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    totalDrivers,
    totalRequests,
    openRequests,
    completedRequests,
    pendingRequests,
    totalNipWallets,
    totalNipInCirculation,
    totalNipEarnedAllTime,
    topDriversByFranchise,
    zones,
  };
};

export const getAdminOverviewSnapshotWithTierCounts = (): AdminOverviewSnapshot & { tierCounts: Record<string, number> } => {
  const snapshot = getAdminOverviewSnapshot();
  const memberships = listAllMemberships();
  const tierCounts = memberships.reduce((acc: Record<string, number>, m) => {
    const key = String(m.tierId);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return { ...snapshot, tierCounts };
};
