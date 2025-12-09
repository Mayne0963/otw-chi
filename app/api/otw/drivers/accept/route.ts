import { NextRequest, NextResponse } from "next/server";
import {
  driverAcceptRequest,
  assignRequestToDriver,
} from "@/lib/otw/otwRequests";
import { OtwDriverId, OtwRequestId } from "@/lib/otw/otwIds";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { driverId, requestId } = body || {};
    if (!driverId || !requestId) {
      return NextResponse.json(
        {
          success: false,
          error: "driverId and requestId are required.",
        },
        { status: 400 }
      );
    }
    const dId = driverId as OtwDriverId;
    const rId = requestId as OtwRequestId;
    // Ensure assignment first if needed
    const assignResult = assignRequestToDriver(rId, dId);
    if (!assignResult.ok) {
      // If it's already assigned to this driver, we proceed to accept
      if (String(assignResult.error).includes("already assigned")) {
        // no-op
      } else {
        return NextResponse.json(
          { success: false, error: assignResult.error },
          { status: 400 }
        );
      }
    }
    const result = driverAcceptRequest(rId, dId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: true, request: result.data },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in POST /api/otw/drivers/accept:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

