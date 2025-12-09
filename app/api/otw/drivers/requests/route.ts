import { NextRequest, NextResponse } from "next/server";
import {
  listRequestsForDriver,
  listOpenRequests,
} from "@/lib/otw/otwRequests";
import { OtwDriverId } from "@/lib/otw/otwIds";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverIdParam = searchParams.get("driverId");
    if (!driverIdParam) {
      return NextResponse.json(
        { success: false, error: "driverId query param is required." },
        { status: 400 }
      );
    }
    const driverId = driverIdParam as OtwDriverId;
    const myRequests = listRequestsForDriver(driverId);
    const openRequests = listOpenRequests();
    return NextResponse.json(
      {
        success: true,
        myRequests,
        openRequests,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in GET /api/otw/drivers/requests:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

