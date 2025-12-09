import { NextRequest, NextResponse } from "next/server";
import { registerDriver } from "@/lib/otw/otwDrivers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { displayName, baseZone } = body || {};
    if (!displayName) {
      return NextResponse.json(
        { success: false, error: "displayName is required." },
        { status: 400 }
      );
    }
    const result = registerDriver({
      displayName,
      baseZone: baseZone || "GENERAL",
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: true, driver: result.data },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error in POST /api/otw/drivers/register:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

