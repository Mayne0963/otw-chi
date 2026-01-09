import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "DRIVER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const prisma = getPrisma();
    const req = await prisma.request.findUnique({
      where: { id },
      select: {
        id: true,
        pickup: true,
        dropoff: true,
      },
    });

    if (!req) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const stops = [
      {
        id: `${req.id}-pickup`,
        label: req.pickup,
        type: "pickup" as const,
        lat: null,
        lng: null,
      },
      {
        id: `${req.id}-dropoff`,
        label: req.dropoff,
        type: "dropoff" as const,
        lat: null,
        lng: null,
      },
    ];

    return NextResponse.json({ id: req.id, stops });
  } catch (error) {
    console.error("[JOB_LOOKUP_ERROR]", error);
    return NextResponse.json({ error: "Unable to load job" }, { status: 500 });
  }
}
