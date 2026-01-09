import { NextResponse } from "next/server";
import { requireHereApiKey } from "@/lib/navigation/hereEnv";

type HereIncidentResponse = {
  TRAFFIC_ITEMS?: {
    TRAFFIC_ITEM?: Array<{
      TRAFFIC_ITEM_ID?: string;
      CRITICALITY?: { description?: string; id?: string };
      TRAFFIC_ITEM_DESCRIPTION?: Array<{ value?: string }>;
      LOCATION?: {
        SHAPES?: {
          SHP?: Array<{ value?: string }>;
        };
      };
      START_TIME?: string;
      END_TIME?: string;
      VERIFIED?: boolean;
    }>;
  };
};

const parseShapePoint = (value: string): [number, number] | null => {
  const firstPair = value.trim().split(" ")[0];
  const [lat, lng] = firstPair.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lng, lat];
};

const cache = new Map<
  string,
  { expires: number; data: any; cooldownUntil?: number }
>();
const TTL_MS = 120_000;
const RATE_LIMIT_DEFAULT_COOLDOWN_MS = 120_000;
const LOG_THROTTLE_MS = 60_000;
let lastLogAt = 0;

export async function GET(request: Request) {
  try {
    const HERE_API_KEY = requireHereApiKey();

    const requestOrigin = new URL(request.url).origin;
    const hereHeaders = {
      Origin: requestOrigin,
      Referer: `${requestOrigin}/`,
    };

    const { searchParams } = new URL(request.url);
    const bbox = searchParams.get("bbox");
    if (!bbox) {
      return NextResponse.json(
        { success: false, error: "bbox is required." },
        { status: 400 }
      );
    }

    const cacheKey = bbox;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && now < cached.expires) {
      if (cached.cooldownUntil && now < cached.cooldownUntil) {
        return NextResponse.json({
          ok: false,
          rateLimited: true,
          retryAfterSec: Math.ceil((cached.cooldownUntil - now) / 1000),
          data: null,
        });
      }
      return NextResponse.json({ ok: true, incidents: cached.data });
    }

    if (cached?.cooldownUntil && now < cached.cooldownUntil) {
      return NextResponse.json({
        ok: false,
        rateLimited: true,
        retryAfterSec: Math.ceil((cached.cooldownUntil - now) / 1000),
        data: null,
      });
    }

    const url = new URL("https://traffic.ls.hereapi.com/traffic/6.3/incidents.json");
    url.searchParams.set("bbox", bbox);
    url.searchParams.set("apiKey", HERE_API_KEY);

    const res = await fetch(url, { cache: "no-store", headers: hereHeaders });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after")) || RATE_LIMIT_DEFAULT_COOLDOWN_MS / 1000;
      cache.set(cacheKey, {
        expires: now + TTL_MS,
        data: cached?.data ?? null,
        cooldownUntil: now + retryAfter * 1000,
      });
      if (now - lastLogAt > LOG_THROTTLE_MS) {
        console.warn("[HERE_INCIDENTS_RATE_LIMIT]", res.status);
        lastLogAt = now;
      }
      return NextResponse.json({
        ok: false,
        rateLimited: true,
        retryAfterSec: retryAfter,
        data: null,
      });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (now - lastLogAt > LOG_THROTTLE_MS) {
        console.warn("[HERE_INCIDENTS_ERROR]", res.status, text.slice(0, 200));
        lastLogAt = now;
      }
      return NextResponse.json({ ok: false, error: "unavailable", data: null });
    }

    const data = (await res.json()) as HereIncidentResponse;
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

    data.TRAFFIC_ITEMS?.TRAFFIC_ITEM?.forEach((item) => {
      const shape = item.LOCATION?.SHAPES?.SHP?.[0]?.value;
      if (!shape) return;
      const point = parseShapePoint(shape);
      if (!point) return;
      const description = item.TRAFFIC_ITEM_DESCRIPTION?.[0]?.value;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: point },
        properties: {
          id: item.TRAFFIC_ITEM_ID,
          severity: item.CRITICALITY?.description || item.CRITICALITY?.id,
          description,
          startTime: item.START_TIME,
          endTime: item.END_TIME,
          verified: item.VERIFIED,
        },
      });
    });

    const payload = {
      type: "FeatureCollection",
      features,
    };
    cache.set(cacheKey, { expires: now + TTL_MS, data: payload });

    return NextResponse.json({ ok: true, incidents: payload });
  } catch (error) {
    if (Date.now() - lastLogAt > LOG_THROTTLE_MS) {
      console.error("[INCIDENT_FETCH_ERROR]", error);
      lastLogAt = Date.now();
    }
    return NextResponse.json({ ok: false, error: "unavailable", data: null });
  }
}
