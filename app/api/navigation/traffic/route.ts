import { NextResponse } from "next/server";
import { requireHereApiKey } from "@/lib/navigation/hereEnv";

type HereTrafficFlowResponse = {
  RWS?: Array<{
    RW?: Array<{
      FIS?: Array<{
        FI?: Array<{
          TMC?: { PC?: number; DE?: string };
          SHP?: Array<{ value: string }>;
          CF?: Array<{ JF?: number; SP?: number; SU?: number; FF?: number; CN?: number }>;
        }>;
      }>;
    }>;
  }>;
};

const parseShape = (value: string): [number, number][] => {
  return value
    .trim()
    .split(" ")
    .map((pair) => {
      const [lat, lng] = pair.split(",").map(Number);
      return [lng, lat] as [number, number];
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
};

const cache = new Map<
  string,
  { expires: number; data: GeoJSON.FeatureCollection | null; cooldownUntil?: number }
>();

const TTL_MS = 60_000;
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
      return NextResponse.json({ ok: true, flow: cached.data });
    }

    if (cached?.cooldownUntil && now < cached.cooldownUntil) {
      return NextResponse.json({
        ok: false,
        rateLimited: true,
        retryAfterSec: Math.ceil((cached.cooldownUntil - now) / 1000),
        data: null,
      });
    }

    const url = new URL("https://traffic.ls.hereapi.com/traffic/6.3/flow.json");
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
        console.warn("[HERE_TRAFFIC_RATE_LIMIT]", res.status);
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
        console.warn("[HERE_TRAFFIC_ERROR]", res.status, text.slice(0, 200));
        lastLogAt = now;
      }
      return NextResponse.json({ ok: false, error: "unavailable", data: null });
    }

    const data = (await res.json()) as HereTrafficFlowResponse;
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

    data.RWS?.forEach((rws) => {
      rws.RW?.forEach((rw) => {
        rw.FIS?.forEach((fis) => {
          fis.FI?.forEach((fi) => {
            const shape = fi.SHP?.[0]?.value;
            if (!shape) return;
            const coords = parseShape(shape);
            if (coords.length < 2) return;
            const cf = fi.CF?.[0] || {};
            features.push({
              type: "Feature",
              geometry: { type: "LineString", coordinates: coords },
              properties: {
                jamFactor: cf.JF,
                speed: cf.SP,
                speedUncapped: cf.SU,
                freeFlow: cf.FF,
                confidence: cf.CN,
                description: fi.TMC?.DE,
              },
            });
          });
        });
      });
    });

    const payload: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features,
    };
    cache.set(cacheKey, { expires: now + TTL_MS, data: payload });

    return NextResponse.json({ ok: true, flow: payload });
  } catch (error) {
    if (Date.now() - lastLogAt > LOG_THROTTLE_MS) {
      console.error("[TRAFFIC_FLOW_ERROR]", error);
      lastLogAt = Date.now();
    }
    return NextResponse.json({ ok: false, error: "unavailable", data: null });
  }
}
