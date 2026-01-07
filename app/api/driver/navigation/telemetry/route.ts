import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const telemetrySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  speedMps: z.number().optional().nullable(),
  heading: z.number().optional().nullable(),
  accuracy: z.number().optional().nullable(),
  altitude: z.number().optional().nullable(),
  batteryLevel: z.number().min(0).max(1).optional().nullable(),
  batteryCharging: z.boolean().optional().nullable(),
  requestId: z.string().optional().nullable(),
  deliveryRequestId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { driverProfile: true },
    });

    if (!user?.driverProfile) {
      return NextResponse.json({ success: false, error: "Driver profile not found" }, { status: 404 });
    }

    const payload = telemetrySchema.parse(await req.json());

    const telemetry = await prisma.driverTelemetry.create({
      data: {
        driverId: user.driverProfile.id,
        requestId: payload.requestId ?? undefined,
        deliveryRequestId: payload.deliveryRequestId ?? undefined,
        lat: payload.lat,
        lng: payload.lng,
        speedMps: payload.speedMps ?? undefined,
        heading: payload.heading ?? undefined,
        accuracy: payload.accuracy ?? undefined,
        altitude: payload.altitude ?? undefined,
        batteryLevel: payload.batteryLevel ?? undefined,
        batteryCharging: payload.batteryCharging ?? undefined,
      },
    });

    return NextResponse.json({ success: true, telemetryId: telemetry.id });
  } catch (error) {
    console.error("Driver telemetry POST error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid telemetry payload." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to record telemetry." },
      { status: 500 }
    );
  }
}
