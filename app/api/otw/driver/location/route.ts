import { NextRequest, NextResponse } from "next/server";
import { upsertDriverLocation } from "../../../../lib/otw/otwDriverLocation";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { driverId, lat, lng, label, currentRequestId } = body || {};

    if (!driverId || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { success: false, error: "driverId, lat, lng are required." },
        { status: 400 }
      );
    }

    const updated = upsertDriverLocation(
      String(driverId),
      { lat, lng, label },
      currentRequestId ? String(currentRequestId) : undefined
    );

    return NextResponse.json(
      { success: true, location: updated },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error updating driver location:", err);
    return NextResponse.json(
      { success: false, error: "Unable to update driver location." },
      { status: 500 }
    );
  }
}
