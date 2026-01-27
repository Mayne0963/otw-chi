import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const prisma = getPrisma();

  const cities = await prisma.city.findMany({
    orderBy: { name: "asc" },
    include: {
      zones: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, cityId: true },
      },
    },
  });

  const payload = {
    cities: cities.map((city) => ({
      id: city.id,
      name: city.name,
      zones: city.zones.map((z) => ({ id: z.id, name: z.name, cityId: z.cityId })),
    })),
  };

  const version = createHash("sha1").update(JSON.stringify(payload)).digest("hex");

  return NextResponse.json(
    { version, updatedAtIso: null, data: payload },
    {
      headers: {
        ETag: `"${version}"`,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    }
  );
}

