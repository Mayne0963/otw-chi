import { NextRequest, NextResponse } from "next/server";
import { ServiceType, Urgency } from "../../../../lib/otw/otwTypes";

interface EstimateRequestBody {
  serviceType: ServiceType;
  urgency: Urgency;
  pickupArea: string;
  dropoffArea: string;
  notes?: string;
}

const estimateMiles = (payload: EstimateRequestBody) => {
  const { serviceType, urgency, pickupArea, dropoffArea, notes = "" } = payload;

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

  const textComplexitySource = (pickupArea + dropoffArea + notes).trim();
  const rawComplexity = Math.floor(textComplexitySource.length / 10) * 10;
  const complexityBonus = Math.min(300, rawComplexity);

  const roughMiles = (base + complexityBonus) * urgencyMultiplier[urgency];
  const estimatedMiles = Math.round(roughMiles / 10) * 10;

  return {
    estimatedMiles,
    breakdown: {
      base,
      complexityBonus,
      urgencyMultiplier: urgencyMultiplier[urgency],
    },
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<EstimateRequestBody>;

    if (!body.serviceType || !body.urgency || !body.pickupArea || !body.dropoffArea) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const payload: EstimateRequestBody = {
      serviceType: body.serviceType as ServiceType,
      urgency: body.urgency as Urgency,
      pickupArea: String(body.pickupArea),
      dropoffArea: String(body.dropoffArea),
      notes: body.notes ? String(body.notes) : "",
    };

    const result = estimateMiles(payload);

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("OTW estimate error:", err);
    return NextResponse.json({ error: "Unable to calculate estimate." }, { status: 500 });
  }
}
