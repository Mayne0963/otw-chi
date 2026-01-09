import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildRoutingV8Url,
  cacheRouteResponse,
  getCachedRouteResponse,
  parseHereRouteToOtw,
  safeFetchJson,
  type HereRouteResponse,
} from "@/lib/here";
import { requireHereApiKey } from "@/lib/navigation/hereEnv";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const stopSchema = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  type: z.enum(["pickup", "dropoff"]).optional(),
});

const requestSchema = z.object({
  origin: stopSchema,
  stops: z.array(stopSchema).min(1),
  mode: z.literal("car").default("car"),
  avoid: z
    .object({
      tolls: z.boolean().optional(),
      ferries: z.boolean().optional(),
  })
    .optional(),
});

const roundCoord = (value: number, precision = 4) =>
  Math.round(value * 10 ** precision) / 10 ** precision;

const buildCacheKey = (origin: any, stops: any[], avoid: any) => {
  const originKey = `${roundCoord(origin.lat)},${roundCoord(origin.lng)}`;
  const stopsKey = stops
    .map((s) => `${roundCoord(s.lat)},${roundCoord(s.lng)},${s.type || "x"}`)
    .join("|");
  const avoidKey = `${avoid?.tolls ? "t" : ""}${avoid?.ferries ? "f" : ""}`;
  return `${originKey}->${stopsKey}|${avoidKey}`;
};

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";
    const limit = rateLimit({ key: `route:${ip}`, intervalMs: 60_000, max: 30 });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const json = await request.json();
    const { origin, stops, mode, avoid } = requestSchema.parse(json);

    const cacheKey = buildCacheKey(origin, stops, avoid);
    const cached = getCachedRouteResponse(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { "x-otw-cache": "hit" } });
    }

    const apiKey = requireHereApiKey();
    const url = buildRoutingV8Url({ origin, stops, apiKey, mode, avoid });
    const data = await safeFetchJson<HereRouteResponse>(url, {
      headers: {
        Origin: new URL(request.url).origin,
        Referer: `${new URL(request.url).origin}/`,
      },
    });

    const otw = parseHereRouteToOtw(data, stops.length);
    cacheRouteResponse(cacheKey, otw);
    return NextResponse.json(otw, { headers: { "x-otw-cache": "miss" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.startsWith("Upstream HERE error")) {
      return NextResponse.json({ error: "Unable to calculate route" }, { status: 500 });
    }

    console.error("[ROUTE_API_ERROR]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
