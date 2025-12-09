import { NextRequest, NextResponse } from "next/server";
import { ServiceType, Urgency } from "../../../../lib/otw/otwTypes";
import type { OtwMatchContext } from "../../../../lib/otw/otwTypes";
import { findBestDriversForRequest } from "../../../../lib/otw/otwMatching";
import {
  getMembershipForCustomer,
  updateMembershipMilesUsed,
  estimateRemainingMiles,
  evaluateTierRequestEligibility,
} from "../../../../lib/otw/otwMembership";

export interface OtwRequest {
  id: string;
  serviceType: ServiceType;
  urgency: Urgency;
  pickupArea: string;
  dropoffArea: string;
  notes?: string;
  createdAt: string; // ISO timestamp
  estimatedMiles: number;
  status: "PENDING" | "MATCHED" | "COMPLETED" | "CANCELLED";
  customerId?: string; // mock customer linkage
  assignedDriverId?: string; // matched driver id
  matchScore?: number; // matched driver score
}

const otwRequests: OtwRequest[] = [];

// Pre-populate a couple of mock entries
otwRequests.push(
  {
    id: "REQ-1",
    serviceType: "ERRAND",
    urgency: "NORMAL",
    pickupArea: "North Fort Wayne",
    dropoffArea: "South Decatur Rd",
    notes: "Grocery run test job",
    createdAt: new Date().toISOString(),
    estimatedMiles: 540,
    status: "COMPLETED",
  },
  {
    id: "REQ-2",
    serviceType: "BIG_HAUL",
    urgency: "PRIORITY",
    pickupArea: "Best Buy – Lima Rd",
    dropoffArea: "Coldwater Rd",
    notes: "65\" TV and soundbar",
    createdAt: new Date().toISOString(),
    estimatedMiles: 980,
    status: "PENDING",
  }
);

const estimateMilesForRequest = (
  serviceType: ServiceType,
  urgency: Urgency,
  pickupArea: string,
  dropoffArea: string,
  notes?: string
): number => {
  const text = (pickupArea + dropoffArea + (notes || "")).trim();

  const baseByService: Record<ServiceType, number> = {
    ERRAND: 500,
    FOOD: 400,
    BIG_HAUL: 900,
    DOCUMENT: 600,
    VIP: 700,
    OTHER: 1100,
  };

  const urgencyMultiplier: Record<Urgency, number> = {
    NORMAL: 1,
    PRIORITY: 1.2,
    RUSH: 1.4,
  };

  const base = baseByService[serviceType];
  const rawComplexity = Math.floor(text.length / 10) * 10;
  const complexityBonus = Math.min(300, rawComplexity);

  const roughMiles = (base + complexityBonus) * urgencyMultiplier[urgency];
  return Math.round(roughMiles / 10) * 10;
};

export async function GET() {
  return NextResponse.json({ success: true, requests: otwRequests }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { serviceType, urgency, pickupArea, dropoffArea, notes } = body as {
      serviceType?: ServiceType;
      urgency?: Urgency;
      pickupArea?: string;
      dropoffArea?: string;
      notes?: string;
    };

    if (!serviceType || !urgency || !pickupArea || !dropoffArea) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const estimatedMiles = estimateMilesForRequest(
      serviceType,
      urgency,
      String(pickupArea),
      String(dropoffArea),
      notes ? String(notes) : undefined
    );

    // Ensure the customer's tier allows this request before committing
    const customerId = "CUSTOMER-1";
    const eligibility = evaluateTierRequestEligibility(
      customerId,
      estimatedMiles,
      serviceType as any
    );
    if (!eligibility.allowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            eligibility.reason || "This request is not allowed on your tier.",
          recommendedTierId: eligibility.recommendedTierId || null,
        },
        { status: 400 }
      );
    }

  const newRequest: OtwRequest = {
    id: `REQ-${otwRequests.length + 1}`,
    serviceType,
    urgency,
    pickupArea: String(pickupArea),
    dropoffArea: String(dropoffArea),
    notes: notes ? String(notes) : undefined,
    createdAt: new Date().toISOString(),
    estimatedMiles,
    status: "PENDING",
  };

    // Build the matching context and get driver suggestions
    const matchContext: OtwMatchContext = {
      requestId: newRequest.id,
      serviceType: newRequest.serviceType,
      urgency: newRequest.urgency,
      pickupArea: newRequest.pickupArea,
      dropoffArea: newRequest.dropoffArea,
    };
    const suggestions = findBestDriversForRequest(matchContext, 5);
    if (suggestions.length > 0) {
      const best = suggestions[0];
      newRequest.assignedDriverId = best.driver.driverId;
      newRequest.matchScore = best.score;
      newRequest.status = "MATCHED";
    }

    // Attach mock customer and update membership snapshot
    newRequest.customerId = customerId;

    let membershipUpdate: any = null;
    const membership = getMembershipForCustomer(customerId);
    if (membership && membership.membershipId) {
      const updated = updateMembershipMilesUsed(membership.membershipId, newRequest.estimatedMiles);
      if (updated) {
        const remainingMiles = estimateRemainingMiles(updated);
        membershipUpdate = {
          membershipId: updated.membershipId,
          tierId: updated.tierId,
          milesCap: updated.milesCap,
          milesUsed: updated.milesUsed,
          rolloverMiles: updated.rolloverMiles,
          remainingMiles,
          status: updated.status,
          renewsOn: updated.renewsOn,
        };
      }
    }

    otwRequests.push(newRequest);

    return NextResponse.json(
      { success: true, request: newRequest, membership: membershipUpdate, matchSuggestions: suggestions },
      { status: 201 }
    );
  } catch (err) {
    console.error("OTW request creation error:", err);
    return NextResponse.json({ error: "Unable to create OTW request." }, { status: 500 });
  }
}
