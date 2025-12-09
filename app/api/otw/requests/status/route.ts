import { NextRequest, NextResponse } from "next/server";
import { updateOtwRequestStatus } from "../../../../../lib/otw/otwRequests";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, newStatus } = body || {};
    if (!requestId || !newStatus) {
      return NextResponse.json(
        { success: false, error: "requestId and newStatus are required." },
        { status: 400 }
      );
    }
    const updated = updateOtwRequestStatus(String(requestId), newStatus);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Request not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, request: updated }, { status: 200 });
  } catch (err) {
    console.error("Error updating OTW request status:", err);
    return NextResponse.json(
      { success: false, error: "Unable to update request status." },
      { status: 500 }
    );
  }
}

