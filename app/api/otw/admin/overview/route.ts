import { NextRequest, NextResponse } from "next/server";
import { getAdminOverviewSnapshot } from "../../../../lib/otw/otwAdmin";

export async function GET(_request: NextRequest) {
  try {
    const snapshot = getAdminOverviewSnapshot();
    return NextResponse.json(
      { success: true, overview: snapshot },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in GET /api/otw/admin/overview:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while loading admin overview.",
      },
      { status: 500 }
    );
  }
}
