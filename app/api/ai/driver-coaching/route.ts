import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDriverCoaching } from "@/lib/ai/assist";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  rating: z.number().finite().min(0).max(5),
  onTimeRate: z.number().finite().min(0).max(1),
  cancelRate: z.number().finite().min(0).max(1),
});

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";
    const limit = rateLimit({ key: `ai:driver-coaching:${ip}`, intervalMs: 60_000, max: 60 });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const json = await request.json();
    const metrics = requestSchema.parse(json);
    const coaching = await generateDriverCoaching(metrics);
    return NextResponse.json(coaching);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("[AI_DRIVER_COACHING_ERROR]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

