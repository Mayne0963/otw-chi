import type { OtwDriverProfile, OtwMatchContext, OtwDriverMatchScore } from "./otwTypes";
import { getAvailableDrivers } from "./otwDrivers";
import type { Urgency } from "./otwTypes";

const computeZoneAffinity = (driver: OtwDriverProfile, pickupArea: string): number => {
  const zone = driver.baseZone.toLowerCase();
  const pickup = pickupArea.toLowerCase();
  if (pickup.includes("north") && zone.includes("north")) return 1.0;
  if (pickup.includes("south") && zone.includes("south")) return 1.0;
  if (pickup.includes("central") && zone.includes("central")) return 1.0;
  const zoneWords = zone.split(/\s+/);
  const pickupWords = pickup.split(/\s+/);
  const overlap = zoneWords.filter((w) => pickupWords.includes(w)).length;
  if (overlap > 0) return 0.7;
  return 0.3;
};

const computeWorkloadPenalty = (driver: OtwDriverProfile): number => {
  if (driver.completedJobs < 20) return 0.0;
  if (driver.completedJobs < 50) return 0.1;
  if (driver.completedJobs < 100) return 0.2;
  return 0.3;
};

const computeStatusPenalty = (driver: OtwDriverProfile): number => {
  if (driver.status === "IDLE") return 0.0;
  if (driver.status === "ON_JOB") return 0.3;
  if (driver.status === "OFFLINE") return 0.8;
  return 0.4;
};

const computeUrgencyBoost = (urgency: Urgency): number => {
  if (urgency === "NORMAL") return 0.0;
  if (urgency === "PRIORITY") return 0.15;
  if (urgency === "RUSH") return 0.3;
  return 0.0;
};

const computeRatingBoost = (driver: OtwDriverProfile): number => {
  if (driver.avgRating >= 4.9) return 0.4;
  if (driver.avgRating >= 4.7) return 0.3;
  if (driver.avgRating >= 4.5) return 0.2;
  if (driver.avgRating >= 4.0) return 0.1;
  return 0.0;
};

export const scoreDriverForRequest = (driver: OtwDriverProfile, context: OtwMatchContext): OtwDriverMatchScore => {
  const zoneAffinity = computeZoneAffinity(driver, context.pickupArea);
  const ratingBoost = computeRatingBoost(driver);
  const workloadPenalty = computeWorkloadPenalty(driver);
  const statusPenalty = computeStatusPenalty(driver);
  const urgencyBoost = computeUrgencyBoost(context.urgency);

  let score = zoneAffinity * 3 + ratingBoost * 2 + urgencyBoost * 2;
  score -= workloadPenalty * 2;
  score -= statusPenalty * 2;

  return {
    driver,
    score,
    factors: { zoneAffinity, ratingBoost, workloadPenalty, statusPenalty, urgencyBoost },
  };
};

export const findBestDriversForRequest = (context: OtwMatchContext, limit = 5): OtwDriverMatchScore[] => {
  const drivers = getAvailableDrivers();
  const scored = drivers.map((driver) => scoreDriverForRequest(driver, context));
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
};

