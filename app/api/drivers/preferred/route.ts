import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const drivers = await prisma.driverProfile.findMany({
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { user: { email: "asc" } },
  });

  return NextResponse.json(
    {
      drivers: drivers.map((d) => ({
        id: d.id,
        name: d.user.name || d.user.email,
      })),
    },
    { status: 200 }
  );
}

