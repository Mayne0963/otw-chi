import { NextResponse } from "next/server";

const HERE_API_KEY = process.env.HERE_API_KEY;

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

export async function GET(request: Request) {
  try {
    if (!HERE_API_KEY) {
      return NextResponse.json(
        { success: false, error: "HERE_API_KEY is not configured." },
        { status: 500 }
      );
    }

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

    const url = new URL("https://traffic.ls.hereapi.com/traffic/6.3/flow.json");
    url.searchParams.set("bbox", bbox);
    url.searchParams.set("apiKey", HERE_API_KEY);

    const res = await fetch(url, { cache: "no-store", headers: hereHeaders });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `HERE traffic flow failed: ${res.status} ${text}` },
        { status: 502 }
      );
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

    return NextResponse.json({
      success: true,
      flow: {
        type: "FeatureCollection",
        features,
      },
    });
  } catch (error) {
    console.error("Traffic flow error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load traffic flow." },
      { status: 500 }
    );
  }
}
