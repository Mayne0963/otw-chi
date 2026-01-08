import { NextResponse } from "next/server";

const HERE_API_KEY = process.env.HERE_API_KEY;

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

    const url = new URL("https://traffic.ls.hereapi.com/traffic/6.3/incidents.json");
    url.searchParams.set("bbox", bbox);
    url.searchParams.set("apiKey", HERE_API_KEY);

    const res = await fetch(url, { cache: "no-store", headers: hereHeaders });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `HERE incidents failed: ${res.status} ${text}` },
        { status: 502 }
      );
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

    return NextResponse.json({
      success: true,
      incidents: {
        type: "FeatureCollection",
        features,
      },
    });
  } catch (error) {
    console.error("Incident fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load incidents." },
      { status: 500 }
    );
  }
}
