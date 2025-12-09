import { NextRequest, NextResponse } from "next/server";
import { OtwFeedback } from "../../../../lib/otw/otwTypes";
import {
  addFeedback,
  getAllFeedback,
  getFeedbackForDriver,
} from "../../../../lib/otw/otwReputation";
import { getOtwRequestById } from "../../../../lib/otw/otwRequests";

const buildFeedback = (body: any): OtwFeedback | { error: string } => {
  const { requestId, driverId, customerId, rating, comment } = body || {};

  if (!requestId || !driverId || !customerId || typeof rating !== "number") {
    return { error: "Missing required fields or invalid rating." };
  }

  if (rating < 1 || rating > 5) {
    return { error: "Rating must be between 1 and 5." };
  }

  const feedback: OtwFeedback = {
    id: `FB-${Date.now()}`,
    requestId: String(requestId),
    driverId: String(driverId),
    customerId: String(customerId),
    rating,
    comment: comment ? String(comment) : undefined,
    rater: "CUSTOMER",
    createdAt: new Date().toISOString(),
  };

  return feedback;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get("driverId");

  const feedback = driverId ? getFeedbackForDriver(driverId) : getAllFeedback();

  return NextResponse.json({ success: true, feedback }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const built = buildFeedback(body);

    if ("error" in built) {
      return NextResponse.json(
        { success: false, error: built.error },
        { status: 400 }
      );
    }

    const feedback = built as OtwFeedback;
    const requestRecord = getOtwRequestById(String(feedback.requestId));
    if (!requestRecord) {
      return NextResponse.json(
        { success: false, error: "Request not found for feedback." },
        { status: 404 }
      );
    }
    if (requestRecord.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Feedback can only be submitted for completed OTW requests.",
        },
        { status: 400 }
      );
    }

    const saved = addFeedback(built);
    return NextResponse.json(
      { success: true, feedback: saved },
      { status: 201 }
    );
  } catch (err) {
    console.error("OTW feedback error:", err);
    return NextResponse.json(
      { success: false, error: "Unable to save feedback." },
      { status: 500 }
    );
  }
}
