import { NextRequest, NextResponse } from "next/server";
import { getAllDrivers } from "@/lib/otw/otwDrivers";
import { getAllOtwRequests } from "@/lib/otw/otwRequests";
import { evaluateDriverFranchiseReadiness } from "@/lib/otw/otwFranchise";

export async function GET(_request: NextRequest) {
  try {
    const drivers = getAllDrivers?.() || [];
    const driverId = "DRIVER-1";
    const driver = drivers.find((d) => d.driverId === driverId);
    if (!driver) {
      return NextResponse.json(
        { success: false, error: "Driver not found." },
        { status: 404 }
      );
    }
    const requests = getAllOtwRequests?.() || [];
    const evalResult = evaluateDriverFranchiseReadiness(driver, requests);
    return NextResponse.json(
      { success: true, franchise: evalResult },
      { status: 200 }
    );
  } catch (err) {
    console.error("Driver franchise eval error:", err);
    return NextResponse.json(
      { success: false, error: "Unable to load franchise evaluation." },
      { status: 500 }
    );
  }
}
