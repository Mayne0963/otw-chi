import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const prisma = getPrisma();
  const names = ["OTW BASIC", "OTW PLUS", "OTW PRO", "OTW ELITE", "OTW BLACK"];

  const plans = await prisma.membershipPlan.findMany({
    where: { name: { in: names } },
    orderBy: { priorityLevel: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      monthlyServiceMiles: true,
      rolloverCapMiles: true,
      priorityLevel: true,
      markupFree: true,
      cashAllowed: true,
      peerToPeerAllowed: true,
      allowedServiceTypes: true,
      updatedAt: true,
    },
  });

  const maxUpdatedAt = plans.reduce<Date | null>((acc, plan) => {
    if (!acc) return plan.updatedAt;
    return plan.updatedAt > acc ? plan.updatedAt : acc;
  }, null);

  const version = `${maxUpdatedAt ? maxUpdatedAt.getTime() : 0}:${plans.length}`;
  const updatedAtIso = maxUpdatedAt ? maxUpdatedAt.toISOString() : null;

  return NextResponse.json(
    {
      version,
      updatedAtIso,
      data: plans.map((plan) => ({
        ...plan,
        updatedAt: plan.updatedAt.toISOString(),
      })),
    },
    {
      headers: {
        ETag: `"${version}"`,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}

