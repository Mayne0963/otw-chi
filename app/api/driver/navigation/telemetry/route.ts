import { NextResponse } from "next/server";
import { getNeonSession } from "@/lib/auth/server";
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
  deliveryRequestId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const session = await getNeonSession();
    // @ts-ignore
    const userId = session?.userId || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    
    let user = await prisma.user.findUnique({
      where: { neonAuthId: userId },
      include: { driverProfile: true },
    });

    if (!user) {
      // @ts-ignore
      const email = session?.user?.email;
      if (!email) {
        return NextResponse.json({ success: false, error: "Missing user email" }, { status: 400 });
      }
      // Default to CUSTOMER if creating new
      user = await prisma.user.create({
        data: { neonAuthId: userId, email, role: "CUSTOMER" },
        include: { driverProfile: true },
      });
    }

    // Role is authoritative in DB
    const isDriverish = user.role === "DRIVER" || user.role === "ADMIN";
    
    if (!isDriverish && !user.driverProfile) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (!user.driverProfile && isDriverish) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          driverProfile: {
            create: {
              status: "OFFLINE",
            },
          },
        },
        include: { driverProfile: true },
      });
    }

    if (!user.driverProfile) {
      return NextResponse.json({ success: false, error: "Driver profile not found" }, { status: 404 });
    }

    const payload = telemetrySchema.parse(await req.json());

    const telemetry = await prisma.driverTelemetry.create({
      data: {
        driverId: user.driverProfile.id,
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

    const desiredStatus = payload.deliveryRequestId ? "BUSY" : "ONLINE";
    try {
      if (user.driverProfile.status !== desiredStatus) {
        await prisma.driverProfile.update({
          where: { id: user.driverProfile.id },
          data: { status: desiredStatus },
        });
      }
    } catch (statusError) {
      console.error("Driver status update error:", statusError);
    }

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
