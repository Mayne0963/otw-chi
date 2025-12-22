import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/roles";
import {
  listRequestsForDriver,
  listOpenRequests,
  listOpenRequestsForZone,
} from "@/lib/otw/otwRequests";
import { OtwDriverId, OtwZoneId } from "@/lib/otw/otwIds";
import { getDriverById } from "@/lib/otw/otwDrivers";

export async function GET(request: NextRequest) {
  try {
    await requireRole(["DRIVER", "ADMIN"]);
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
    const driver = getDriverById(driverId);
    let openRequests = listOpenRequests();
    if (driver) {
      const zoneId = (driver.primaryZoneId ?? driver.allowedZoneIds?.[0]) as OtwZoneId | undefined;
      if (zoneId) {
        openRequests = listOpenRequestsForZone(zoneId);
      }
    }
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
