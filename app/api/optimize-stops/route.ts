import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildWaypointsSequenceUrl,
  parseHereSequenceToOtw,
  safeFetchJson,
} from "@/lib/here";
import { requireHereApiKey } from "@/lib/navigation/hereEnv";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const stopSchema = z.object({
  id: z.string().min(1),
  lat: z.number().finite(),
  lng: z.number().finite(),
});

const requestSchema = z.object({
  start: z.object({
    lat: z.number().finite(),
    lng: z.number().finite(),
  }),
  stops: z.array(stopSchema).min(1),
  improveFor: z.enum(["time", "distance"]),
});

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";
    const limit = rateLimit({ key: `optimize:${ip}`, intervalMs: 60_000, max: 10 });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const { start, stops, improveFor } = requestSchema.parse(body);

    const apiKey = requireHereApiKey();
    const url = buildWaypointsSequenceUrl({
      start,
      stops,
      apiKey,
      improveFor,
    });

    const data = await safeFetchJson(url, {
      headers: {
        Origin: new URL(request.url).origin,
        Referer: `${new URL(request.url).origin}/`,
      },
    });

    const parsed = parseHereSequenceToOtw(data as any, new Set(stops.map((s) => s.id)));
    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message.startsWith("Upstream HERE error")) {
      return NextResponse.json({ error: "Unable to optimize stops" }, { status: 500 });
    }
    console.error("[OPTIMIZE_STOPS_ERROR]", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
