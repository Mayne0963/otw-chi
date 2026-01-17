import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
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
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    const normalizeRole = (raw: unknown) => {
      const role = String(raw ?? "").toUpperCase();
      if (role === "ADMIN" || role === "DRIVER" || role === "FRANCHISE" || role === "CUSTOMER") {
        return role as "ADMIN" | "DRIVER" | "FRANCHISE" | "CUSTOMER";
      }
      return "CUSTOMER";
    };

    const sessionRoleRaw = (
      sessionClaims as {
        publicMetadata?: { role?: string };
        metadata?: { role?: string };
        otw?: { role?: string };
      } | null
    )?.publicMetadata?.role ??
      (
        sessionClaims as {
          publicMetadata?: { role?: string };
          metadata?: { role?: string };
          otw?: { role?: string };
        } | null
      )?.metadata?.role ??
      (
        sessionClaims as {
          publicMetadata?: { role?: string };
          metadata?: { role?: string };
          otw?: { role?: string };
        } | null
      )?.otw?.role ??
      null;

    const sessionRole = normalizeRole(sessionRoleRaw);

    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { driverProfile: true },
    });

    if (!user) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
      if (!email) {
        return NextResponse.json({ success: false, error: "Missing user email" }, { status: 400 });
      }
      const role =
        sessionRole !== "CUSTOMER"
          ? sessionRole
          : normalizeRole(clerkUser?.publicMetadata?.role);
      user = await prisma.user.create({
        data: { clerkId: userId, email, role },
        include: { driverProfile: true },
      });
    }

    const resolvedRole =
      user.role === "CUSTOMER" && sessionRole !== "CUSTOMER"
        ? sessionRole
        : (user.role as "ADMIN" | "DRIVER" | "FRANCHISE" | "CUSTOMER");

    if (resolvedRole !== user.role) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: resolvedRole },
        include: { driverProfile: true },
      });
    }

    const isDriverish = resolvedRole === "DRIVER" || resolvedRole === "ADMIN";
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

    const desiredStatus = payload.requestId || payload.deliveryRequestId ? "BUSY" : "ONLINE";
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
