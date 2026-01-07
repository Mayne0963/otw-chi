import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPrisma } from "@/lib/db";
import { z } from "zod";

const settingsSchema = z.object({
  voiceEnabled: z.boolean().optional(),
  voiceLocale: z.enum(["en-US", "es-US"]).optional(),
  voiceVolume: z.number().min(0).max(1).optional(),
  detailLevel: z.enum(["standard", "compact", "detailed"]).optional(),
});

const defaultSettings = {
  voiceEnabled: true,
  voiceLocale: "en-US",
  voiceVolume: 0.7,
  detailLevel: "standard",
};

async function getDriverProfile() {
  const { userId } = await auth();
  if (!userId) return null;
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { driverProfile: true },
  });
  if (!user?.driverProfile) return null;
  return user.driverProfile;
}

export async function GET() {
  try {
    const driverProfile = await getDriverProfile();
    if (!driverProfile) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    const existing = await prisma.driverNavigationSettings.findUnique({
      where: { driverId: driverProfile.id },
    });

    if (!existing) {
      const created = await prisma.driverNavigationSettings.create({
        data: {
          driverId: driverProfile.id,
          ...defaultSettings,
        },
      });
      return NextResponse.json({ success: true, settings: created });
    }

    return NextResponse.json({ success: true, settings: existing });
  } catch (error) {
    console.error("Driver navigation settings GET error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load navigation settings." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const driverProfile = await getDriverProfile();
    if (!driverProfile) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const data = settingsSchema.parse(payload);

    const prisma = getPrisma();
    const updated = await prisma.driverNavigationSettings.upsert({
      where: { driverId: driverProfile.id },
      update: data,
      create: {
        driverId: driverProfile.id,
        ...defaultSettings,
        ...data,
      },
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    console.error("Driver navigation settings PUT error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid settings payload." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to update navigation settings." },
      { status: 500 }
    );
  }
}
