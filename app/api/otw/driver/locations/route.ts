import { NextRequest, NextResponse } from "next/server";
import {
  getAllDriverLocations,
  getDriverLocationsForRequest,
} from "../../../../lib/otw/otwDriverLocation";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");

    let locations = getAllDriverLocations();
    if (requestId) {
      locations = getDriverLocationsForRequest(String(requestId));
    }

    return NextResponse.json({ success: true, locations }, { status: 200 });
  } catch (err) {
    console.error("Error loading driver locations:", err);
    return NextResponse.json(
      { success: false, error: "Unable to load driver locations." },
      { status: 500 }
    );
  }
}
