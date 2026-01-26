import { NextResponse } from "next/server";
import { z } from "zod";
import { enhanceEta } from "@/lib/ai/assist";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  originalEtaMinutes: z.number().finite().min(0).max(24 * 60),
  context: z
    .object({
      weather: z.string().min(1).max(50).optional(),
      traffic: z.string().min(1).max(50).optional(),
      timeOfDay: z.string().min(1).max(50).optional(),
    })
    .optional()
    .default({}),
});

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";
    const limit = rateLimit({ key: `ai:enhance-eta:${ip}`, intervalMs: 60_000, max: 60 });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const json = await request.json();
    const { originalEtaMinutes, context } = requestSchema.parse(json);
    const enhancement = await enhanceEta(originalEtaMinutes, context);
    return NextResponse.json(enhancement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("[AI_ENHANCE_ETA_ERROR]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

