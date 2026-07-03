export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/roles";
import { validateAddress } from "@/lib/geocoding";
import {
  getRequestRouteStopLabel,
  getRequestRouteStops,
  hasRouteStopCoordinates,
} from "@/lib/request-stops";

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
    const req = await prisma.deliveryRequest.findUnique({
      where: { id },
      select: {
        id: true,
        pickupAddress: true,
        dropoffAddress: true,
        quoteBreakdown: true,
      },
    });

    if (!req) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const requestStops = getRequestRouteStops(req.quoteBreakdown, {
      pickupAddress: req.pickupAddress,
      dropoffAddress: req.dropoffAddress,
    });
    const stops = [];

    for (let index = 0; index < requestStops.length; index += 1) {
      const stop = requestStops[index];
      let lat = hasRouteStopCoordinates(stop) ? stop.lat : null;
      let lng = hasRouteStopCoordinates(stop) ? stop.lng : null;
      let label = getRequestRouteStopLabel(stop, index);

      if ((lat === null || lng === null) && stop.address) {
        const geocoded = await validateAddress(stop.address).catch(() => null);
        if (geocoded) {
          lat = geocoded.latitude;
          lng = geocoded.longitude;
          if (!stop.label && geocoded.placeName) {
            label = geocoded.placeName;
          }
        }
      }

      stops.push({
        id: `${req.id}-${stop.type}-${index + 1}`,
        label,
        type: stop.type,
        lat,
        lng,
      });
    }

    return NextResponse.json({ id: req.id, stops });
  } catch (error) {
    console.error("[JOB_LOOKUP_ERROR]", error);
    return NextResponse.json({ error: "Unable to load job" }, { status: 500 });
  }
}
