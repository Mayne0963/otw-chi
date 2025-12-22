import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/roles";
import { driverCompleteRequest } from "@/lib/otw/otwRequests";
import { OtwDriverId, OtwRequestId } from "@/lib/otw/otwIds";

export async function POST(request: NextRequest) {
  try {
    await requireRole(["DRIVER", "ADMIN"]);
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
    const result = await driverCompleteRequest(rId, dId);
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
    console.error("Error in POST /api/otw/drivers/complete:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
