import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyComplaint } from "@/lib/ai/assist";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  text: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";
    const limit = rateLimit({ key: `ai:classify-complaint:${ip}`, intervalMs: 60_000, max: 60 });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const json = await request.json();
    const { text } = requestSchema.parse(json);
    const analysis = await classifyComplaint(text);
    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("[AI_CLASSIFY_COMPLAINT_ERROR]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

