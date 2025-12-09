import { OtwDriverProfile } from "./otwTypes";
import { getWalletForDriver } from "./otwNip";
import { OtwRequest } from "./otwTypes";
import { getAllOtwRequests } from "./otwRequests";
import { getAllDrivers } from "./otwDrivers";
import { computeDriverHealthScore } from "./otwAnalytics";

export type FranchiseRank =
  | "NOT_ELIGIBLE"
  | "SEED"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "EMPIRE";

export interface DriverFranchiseEvaluation {
  driver: OtwDriverProfile;
  franchiseScore: number;
  rank: FranchiseRank;
  reasons: string[];
}

export interface FranchiseReadinessSnapshot {
  driverId: string;
  score: number;
  rank: FranchiseRank;
  eligible: boolean;
  completedJobs: number;
  cancelledJobs: number;
  avgRating: number;
  nipTotalEarned: number;
  lastEvaluatedAt: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const FRANCHISE_THRESHOLDS = {
  eligibleScoreMin: 85,
  candidateScoreMin: 70,
  minCompletedJobsWindow: 40,
  maxCancelRate: 0.08,
  maxDaysInactive: 14,
};

export const rankFromScore = (score: number): FranchiseRank => {
  if (score < 40) return "NOT_ELIGIBLE";
  if (score < 55) return "SEED";
  if (score < 65) return "BRONZE";
  if (score < 75) return "SILVER";
  if (score < 85) return "GOLD";
  if (score < 95) return "PLATINUM";
  return "EMPIRE";
};

export const isFranchiseEligible = (rank: FranchiseRank): boolean => {
  return (
    rank === "BRONZE" ||
    rank === "SILVER" ||
    rank === "GOLD" ||
    rank === "PLATINUM" ||
    rank === "EMPIRE"
  );
};

export const computeFranchiseScore = async (
  driver: OtwDriverProfile
): Promise<FranchiseReadinessSnapshot> => {
  const { driverId, completedJobs, cancelledJobs, avgRating } = driver;

  const jobTarget = 200;
  const jobsRatio = clamp01(completedJobs / jobTarget);
  const jobsScore = jobsRatio * 100;

  const totalAttempts = completedJobs + cancelledJobs;
  const cancelRate = totalAttempts > 0 ? cancelledJobs / totalAttempts : 0;
  const cancelScore = (1 - clamp01(cancelRate)) * 100;

  const ratingScore = clamp01(avgRating / 5) * 100;

  const wallet = getWalletForDriver(driverId);
  const nipTotalEarned = wallet?.totalEarned ?? 0;
  const nipTarget = 10_000;
  const nipRatio = clamp01(nipTotalEarned / nipTarget);
  const nipScore = nipRatio * 100;

  const score = jobsScore * 0.35 + cancelScore * 0.2 + ratingScore * 0.25 + nipScore * 0.2;
  const rank = rankFromScore(score);
  const eligible = isFranchiseEligible(rank);

  return {
    driverId,
    score,
    rank,
    eligible,
    completedJobs,
    cancelledJobs,
    avgRating,
    nipTotalEarned,
    lastEvaluatedAt: new Date().toISOString(),
  };
};

export const evaluateDriverFranchiseReadiness = (
  driver: OtwDriverProfile,
  allRequests: OtwRequest[]
): DriverFranchiseEvaluation => {
  const driverRequests = allRequests.filter(
    (r) => r.assignedDriverId === driver.driverId
  );

  const completed = driverRequests.filter((r) => r.status === "COMPLETED").length;
  const cancelled = driverRequests.filter((r) => r.status === "CANCELLED").length;
  const total = driverRequests.length || 1;

  const cancelRate = cancelled / total;

  const lastCompleted = driverRequests
    .filter((r) => r.status === "COMPLETED")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  let daysSinceLastCompleted = Number.POSITIVE_INFINITY;
  if (lastCompleted) {
    daysSinceLastCompleted =
      (Date.now() - new Date(lastCompleted.createdAt).getTime()) /
      (1000 * 60 * 60 * 24);
  }

  const health = computeDriverHealthScore(driver, allRequests);

  const completionRate = completed / total;
  const reliability = clamp(completionRate * (1 - cancelRate * 2), 0, 1);

  const volumeFactor = clamp(Math.log10(completed + 1) / 2, 0, 1);

  let penalty = 0;
  if (daysSinceLastCompleted > 30) penalty += 0.3;
  else if (daysSinceLastCompleted > 14) penalty += 0.15;

  if (cancelRate > 0.3) penalty += 0.4;
  else if (cancelRate > 0.15) penalty += 0.25;
  else if (cancelRate > 0.08) penalty += 0.15;

  let franchiseScore =
    health.score * 0.6 +
    reliability * 20 +
    volumeFactor * 15 -
    penalty * 5;

  franchiseScore = clamp(franchiseScore, 0, 100);

  let rank: FranchiseRank = "NOT_ELIGIBLE";
  const reasons: string[] = [];

  if (franchiseScore >= FRANCHISE_THRESHOLDS.eligibleScoreMin) {
    rank = "ELIGIBLE";
  } else if (franchiseScore >= FRANCHISE_THRESHOLDS.candidateScoreMin) {
    rank = "CANDIDATE";
  } else if (franchiseScore >= 40) {
    rank = "BUILDING";
  } else {
    rank = "NOT_ELIGIBLE";
  }

  if (completed < FRANCHISE_THRESHOLDS.minCompletedJobsWindow) {
    reasons.push(
      `Needs more volume: ${completed}/${FRANCHISE_THRESHOLDS.minCompletedJobsWindow} completed jobs.`
    );
  }
  if (cancelRate > FRANCHISE_THRESHOLDS.maxCancelRate) {
    reasons.push(
      `Cancellation rate too high: ${(cancelRate * 100).toFixed(1)}%.`
    );
  }
  if (daysSinceLastCompleted > FRANCHISE_THRESHOLDS.maxDaysInactive) {
    reasons.push(
      `Inactive: last completed job was ${Math.round(daysSinceLastCompleted)} days ago.`
    );
  }

  return {
    driver,
    franchiseScore,
    rank,
    reasons,
  };
};

export const getFranchiseEvaluationsForAllDrivers = (): DriverFranchiseEvaluation[] => {
  const drivers = getAllDrivers?.() || [];
  const requests = getAllOtwRequests?.() || [];
  const evaluations = drivers.map((d) => evaluateDriverFranchiseReadiness(d, requests));
  return evaluations.sort((a, b) => b.franchiseScore - a.franchiseScore);
};
