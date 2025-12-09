import { NextRequest, NextResponse } from "next/server";
import { listDrivers, evaluateDriverFranchiseReadiness } from "../../../../lib/otw/otwDrivers";
import { OtwDriverId } from "../../../../lib/otw/otwIds";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverIdParam = searchParams.get("driverId");

    if (!driverIdParam) {
      const drivers = listDrivers().map((d) => ({
        driverId: d.driverId,
        displayName: d.displayName,
        franchiseScore: d.franchiseScore ?? 0,
        franchiseRank: d.franchiseRank ?? "NOT_ELIGIBLE",
        franchiseEligible: d.franchiseEligible ?? false,
      }));
      return NextResponse.json(
        { success: true, mode: "overview", drivers },
        { status: 200 }
      );
    }

    const driverId = driverIdParam as OtwDriverId;
    const updated = await evaluateDriverFranchiseReadiness(driverId);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Driver not found." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        success: true,
        mode: "single",
        driver: {
          driverId: updated.driverId,
          displayName: updated.displayName,
          completedJobs: updated.completedJobs,
          cancelledJobs: updated.cancelledJobs,
          avgRating: updated.avgRating,
          franchiseScore: updated.franchiseScore,
          franchiseRank: updated.franchiseRank,
          franchiseEligible: updated.franchiseEligible,
          franchiseLastEvaluatedAt: updated.franchiseLastEvaluatedAt,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in GET /api/otw/drivers/franchise:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while loading franchise readiness.",
      },
      { status: 500 }
    );
  }
}
