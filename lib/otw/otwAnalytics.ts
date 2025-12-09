import { OtwDriverProfile, OtwRequest, OtwMembership } from "./otwTypes";
import { getAllOtwRequests } from "./otwRequests";
import { getAllMemberships } from "./otwMembership";
import { getAllDrivers } from "./otwDrivers";

export interface DriverHealthScore {
  driver: OtwDriverProfile;
  score: number;
  components: {
    rating: number;
    completionRate: number;
    recencyBoost: number;
    cancelPenalty: number;
  };
}

export interface CustomerHealthScore {
  customerId: string;
  score: number;
  components: {
    usage: number;
    completionRate: number;
    tierQuality: number;
    recencyBoost: number;
    cancelPenalty: number;
  };
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const computeDriverHealthScore = (
  driver: OtwDriverProfile,
  allRequests: OtwRequest[]
): DriverHealthScore => {
  const driverRequests = allRequests.filter(
    (r) => r.assignedDriverId === driver.driverId
  );

  const completed = driverRequests.filter((r) => r.status === "COMPLETED").length;
  const cancelled = driverRequests.filter((r) => r.status === "CANCELLED").length;
  const total = driverRequests.length || 1;

  const completionRate = completed / total;
  const ratingFactor = clamp(driver.avgRating / 5, 0, 1);

  const lastActive = new Date(driver.lastActiveAt).getTime();
  const now = Date.now();
  const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24);

  let recencyBoost = 0;
  if (daysSinceActive <= 1) recencyBoost = 1.0;
  else if (daysSinceActive <= 3) recencyBoost = 0.7;
  else if (daysSinceActive <= 7) recencyBoost = 0.4;
  else if (daysSinceActive <= 30) recencyBoost = 0.15;

  const cancelRate = cancelled / total;
  let cancelPenalty = 0;
  if (cancelRate > 0.3) cancelPenalty = 0.4;
  else if (cancelRate > 0.15) cancelPenalty = 0.25;
  else if (cancelRate > 0.05) cancelPenalty = 0.1;

  let score = ratingFactor * 40 + completionRate * 30 + recencyBoost * 20 - cancelPenalty * 10;
  score = clamp(score, 0, 100);

  return {
    driver,
    score,
    components: {
      rating: ratingFactor,
      completionRate,
      recencyBoost,
      cancelPenalty,
    },
  };
};

export const computeCustomerHealthScore = (
  customerId: string,
  allRequests: OtwRequest[],
  memberships: OtwMembership[]
): CustomerHealthScore => {
  const customerRequests = allRequests.filter((r) => r.customerId === customerId);
  const completed = customerRequests.filter((r) => r.status === "COMPLETED").length;
  const cancelled = customerRequests.filter((r) => r.status === "CANCELLED").length;
  const total = customerRequests.length || 1;

  const completionRate = completed / total;

  const membership = memberships.find((m) => m.customerId === customerId) || null;

  const usageFactor = clamp(Math.log10(completed + 1) / 2, 0, 1);

  let tierQuality = 0;
  if (membership) {
    tierQuality = 0.4;
  }

  let recencyBoost = 0;
  const lastCompleted = customerRequests
    .filter((r) => r.status === "COMPLETED")
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

  if (lastCompleted) {
    const daysSince = (Date.now() - new Date(lastCompleted.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 1) recencyBoost = 1.0;
    else if (daysSince <= 3) recencyBoost = 0.7;
    else if (daysSince <= 7) recencyBoost = 0.4;
    else if (daysSince <= 30) recencyBoost = 0.2;
  }

  const cancelRate = cancelled / total;
  let cancelPenalty = 0;
  if (cancelRate > 0.3) cancelPenalty = 0.4;
  else if (cancelRate > 0.15) cancelPenalty = 0.25;
  else if (cancelRate > 0.05) cancelPenalty = 0.1;

  let score = usageFactor * 25 + completionRate * 25 + tierQuality * 20 + recencyBoost * 20 - cancelPenalty * 10;
  score = clamp(score, 0, 100);

  return {
    customerId,
    score,
    components: {
      usage: usageFactor,
      completionRate,
      tierQuality,
      recencyBoost,
      cancelPenalty,
    },
  };
};

export const getDriverHealthLeaderboard = (): DriverHealthScore[] => {
  const drivers = getAllDrivers?.() || [];
  const requests = getAllOtwRequests?.() || [];
  const scores = drivers.map((d) => computeDriverHealthScore(d, requests));
  return scores.sort((a, b) => b.score - a.score);
};

export const getCustomerHealthLeaderboard = (): CustomerHealthScore[] => {
  const memberships = getAllMemberships?.() || [];
  const requests = getAllOtwRequests?.() || [];
  const customerIds = memberships.map((m) => m.customerId);
  const uniqueCustomerIds = Array.from(new Set(customerIds));
  const scores = uniqueCustomerIds.map((id) => computeCustomerHealthScore(id, requests, memberships));
  return scores.sort((a, b) => b.score - a.score);
};
