import { listDrivers } from "./otwDrivers";
import { listAllRequests } from "./otwRequests";
import { listAllNipWallets } from "./otwNip";
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
    if (isCompletedStatus(r.status as any)) {
      completedRequests++;
    } else if (isOpenStatus(r.status as any)) {
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
  };
};
