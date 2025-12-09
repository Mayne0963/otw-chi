import { NextRequest, NextResponse } from "next/server";
import { OtwMatchContext } from "../../../../lib/otw/otwTypes";
import { findBestDriversForRequest } from "../../../../lib/otw/otwMatching";

interface MatchRequestBody {
  requestId: string;
  serviceType: string;
  urgency: string;
  pickupArea: string;
  dropoffArea: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<MatchRequestBody>;

    if (
      !body.requestId ||
      !body.serviceType ||
      !body.urgency ||
      !body.pickupArea ||
      !body.dropoffArea
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const context: OtwMatchContext = {
      requestId: String(body.requestId),
      serviceType: body.serviceType as any,
      urgency: body.urgency as any,
      pickupArea: String(body.pickupArea),
      dropoffArea: String(body.dropoffArea),
    };

    const suggestions = findBestDriversForRequest(context, 5);

    return NextResponse.json({ success: true, suggestions }, { status: 200 });
  } catch (err) {
    console.error("OTW match error:", err);
    return NextResponse.json(
      { success: false, error: "Unable to generate driver matches." },
      { status: 500 }
    );
  }
}

