import { NextRequest, NextResponse } from "next/server";
import { listAllMemberships } from "@/lib/otw/otwMembership";
import { getAllFeedback } from "@/lib/otw/otwReputation";
import { listDrivers } from "@/lib/otw/otwDrivers";
import {
  getDriverHealthLeaderboard,
  getCustomerHealthLeaderboard,
} from "@/lib/otw/otwAnalytics";
import { getFranchiseEvaluationsForAllDrivers } from "@/lib/otw/otwFranchise";

export async function GET(request: NextRequest) {
  let requests: any[] = [];
  try {
    const base = new URL(request.url).origin;
    const res = await fetch(`${base}/api/otw/requests`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.requests)) {
        requests = json.requests;
      }
    }
  } catch (e) {
    // fallback to empty
  }

  const memberships = listAllMemberships();
  const ratings = getAllFeedback();
  const drivers = listDrivers();

  const totalRequests = requests.length;
  const completedRequests = requests.filter((r) => r.status === "COMPLETED").length;
  const pendingRequests = requests.filter((r) => r.status === "PENDING").length;
  const totalMilesUsed = requests.reduce((t, r) => t + (r.estimatedMiles || 0), 0);
  const averageRating = ratings.length
    ? (ratings.reduce((t, r) => t + (r.rating || 0), 0) / ratings.length).toFixed(2)
    : "N/A";
  const activeMemberships = memberships.length;
  const tierCounts = memberships.reduce((acc: Record<string, number>, m) => {
    const key = String((m as any).tierId);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const driverHealth = getDriverHealthLeaderboard();
  const customerHealth = getCustomerHealthLeaderboard();
  const topDrivers = driverHealth.slice(0, 3);
  const topCustomers = customerHealth.slice(0, 3);

  const franchiseEvaluations = getFranchiseEvaluationsForAllDrivers();
  const franchiseEligible = franchiseEvaluations.filter((e) => e.rank === "ELIGIBLE");
  const franchiseCandidates = franchiseEvaluations.filter((e) => e.rank === "CANDIDATE");

  return NextResponse.json({
    success: true,
    totalRequests,
    completedRequests,
    pendingRequests,
    totalMilesUsed,
    averageRating,
    activeMemberships,
    tierCounts,
    drivers: drivers.length,
    lastUpdated: new Date().toISOString(),
    topDrivers,
    topCustomers,
    franchiseEligible,
    franchiseCandidates,
  });
}
