import { NextResponse } from "next/server";
import { parseHereRoute, parseHereAlternatives, type HereRouteResponse } from "@/lib/navigation/here";
import { requireHereApiKey } from "@/lib/navigation/hereEnv";

const HERE_ENABLE_SPANS = process.env.HERE_ROUTE_SPANS === "true";
const ROUTE_CACHE_TTL_MS = 30_000;
const ROUTE_CACHE_MAX_ENTRIES = 100;

type CachedRoutePayload = {
  success: true;
  route: NonNullable<ReturnType<typeof parseHereRoute>>;
  alternatives: ReturnType<typeof parseHereAlternatives>;
};

const routeCache = new Map<string, { expires: number; payload: CachedRoutePayload }>();

const buildCacheKey = (params: {
  origin: string;
  destination: string;
  alternatives: number;
  lang?: string;
  spans?: boolean;
}) => {
  return [
    params.origin,
    params.destination,
    params.alternatives,
    params.lang || "default",
    params.spans ? "spans" : "no-spans",
  ].join("|");
};

const getCachedRoute = (key: string): CachedRoutePayload | null => {
  const entry = routeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    routeCache.delete(key);
    return null;
  }
  return entry.payload;
};

const setCachedRoute = (key: string, payload: CachedRoutePayload) => {
  routeCache.set(key, { expires: Date.now() + ROUTE_CACHE_TTL_MS, payload });
  if (routeCache.size > ROUTE_CACHE_MAX_ENTRIES) {
    const oldestKey = routeCache.keys().next().value;
    if (oldestKey) routeCache.delete(oldestKey);
  }
};

const buildHereRouteUrl = (params: {
  origin: string;
  destination: string;
  alternatives?: number;
  lang?: string;
  apiKey: string;
}) => {
  const url = new URL("https://router.hereapi.com/v8/routes");
  url.searchParams.set("transportMode", "car");
  url.searchParams.set("origin", params.origin);
  url.searchParams.set("destination", params.destination);
  url.searchParams.set("polyline", "flexible");
  const returnFields = ["summary", "polyline", "actions", "instructions"];
  if (HERE_ENABLE_SPANS) {
    returnFields.push("spans");
    url.searchParams.set("spans", "speedLimit,baseDuration,trafficDelay");
  }
  url.searchParams.set("return", returnFields.join(","));
  url.searchParams.set("routingMode", "fast");
  url.searchParams.set("traffic", "enabled");
  if (params.alternatives && params.alternatives > 0) {
    url.searchParams.set("alternatives", String(params.alternatives));
  }
  if (params.lang) {
    url.searchParams.set("lang", params.lang);
  }
  url.searchParams.set("apiKey", params.apiKey);
  return url.toString();
};

export async function GET(request: Request) {
  try {
    const HERE_API_KEY = requireHereApiKey();

    const requestOrigin = new URL(request.url).origin;
    const hereHeaders = {
      Origin: requestOrigin,
      Referer: `${requestOrigin}/`,
    };

    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const alternatives = Number(searchParams.get("alternatives") || "0");
    const lang = searchParams.get("lang") || undefined;

    if (!origin || !destination) {
      return NextResponse.json(
        { success: false, error: "origin and destination are required." },
        { status: 400 }
      );
    }

    const cacheKey = buildCacheKey({
      origin,
      destination,
      alternatives,
      lang,
      spans: HERE_ENABLE_SPANS,
    });
    const cached = getCachedRoute(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { "x-otw-route-cache": "hit" } });
    }

    const url = buildHereRouteUrl({ origin, destination, alternatives, lang, apiKey: HERE_API_KEY });
    const res = await fetch(url, { cache: "no-store", headers: hereHeaders });
    const raw = await res.text().catch(() => "");
    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error:
              "HERE route failed: 401 Unauthorized. Check HERE key restrictions (allowed domains/referrers) and your Vercel env vars.",
          },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { success: false, error: `HERE route failed: ${res.status} ${raw}` },
        { status: 502 }
      );
    }

    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("HERE route JSON parse failed:", error);
      return NextResponse.json(
        { success: false, error: "HERE route response could not be parsed." },
        { status: 502 }
      );
    }
    const route = parseHereRoute(data as HereRouteResponse);
    if (!route) {
      const routes = (data as HereRouteResponse)?.routes;
      const routeCount = Array.isArray(routes) ? routes.length : 0;
      const firstSection = routes?.[0]?.sections?.[0];
      const hasPolyline = Boolean(firstSection?.polyline);
      return NextResponse.json(
        {
          success: false,
          error: `Unable to parse HERE route response. routes=${routeCount} polyline=${hasPolyline}`,
        },
        { status: 502 }
      );
    }
    const alternativesParsed = parseHereAlternatives(data as HereRouteResponse);

    const payload: CachedRoutePayload = { success: true, route, alternatives: alternativesParsed };
    setCachedRoute(cacheKey, payload);

    return NextResponse.json(payload, { headers: { "x-otw-route-cache": "miss" } });
  } catch (error) {
    console.error("Navigation route error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to fetch navigation route." },
      { status: 500 }
    );
  }
}
