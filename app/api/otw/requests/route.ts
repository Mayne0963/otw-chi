import { NextRequest, NextResponse } from "next/server";
import { Urgency, UiServiceType as ServiceType } from "@/lib/otw/otwTypes";

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
}

const baseByService: Record<ServiceType, number> = {
  MOVE: 500,
  EXCHANGE: 400,
  HAUL: 900,
  PRESENCE: 600,
  BUSINESS: 700,
  MULTI_STOP: 1100,
};

const urgencyMultiplier: Record<Urgency, number> = {
  NORMAL: 1,
  PRIORITY: 1.2,
  RUSH: 1.4,
};

const estimateMilesForRequest = (
  serviceType: ServiceType,
  urgency: Urgency,
  pickupArea: string,
  dropoffArea: string,
  notes?: string
): number => {
  const text = (pickupArea + dropoffArea + (notes || "")).trim();
  const base = baseByService[serviceType];
  const rawComplexity = Math.floor(text.length / 10) * 10;
  const complexityBonus = Math.min(300, rawComplexity);
  const roughMiles = (base + complexityBonus) * urgencyMultiplier[urgency];
  return Math.round(roughMiles / 10) * 10;
};

const otwRequests: OtwRequest[] = [];

otwRequests.push(
  {
    id: "REQ-1",
    serviceType: "MOVE",
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
    serviceType: "HAUL",
    urgency: "PRIORITY",
    pickupArea: "Best Buy – Lima Rd",
    dropoffArea: "Coldwater Rd",
    notes: "65\" TV and soundbar",
    createdAt: new Date().toISOString(),
    estimatedMiles: 980,
    status: "PENDING",
  }
);

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

    otwRequests.push(newRequest);

    return NextResponse.json({ success: true, request: newRequest }, { status: 201 });
  } catch (err) {
    console.error("OTW request creation error:", err);
    return NextResponse.json({ error: "Unable to create OTW request." }, { status: 500 });
  }
}

