import { OtwDriverProfile, OtwRequest } from "./otwTypes";
import { getAllOtwRequests } from "./otwRequests";
import { getAllDrivers } from "./otwDrivers";
import { computeDriverHealthScore } from "./otwAnalytics";

export type FranchiseRank =
  | "ELIGIBLE"
  | "CANDIDATE"
  | "BUILDING"
  | "NOT_ELIGIBLE";

export interface DriverFranchiseEvaluation {
  driver: OtwDriverProfile;
  franchiseScore: number;
  rank: FranchiseRank;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const FRANCHISE_THRESHOLDS = {
  eligibleScoreMin: 85,
  candidateScoreMin: 70,
  minCompletedJobsWindow: 40,
  maxCancelRate: 0.08,
  maxDaysInactive: 14,
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
