import { NextResponse } from "next/server";

const HERE_API_KEY = process.env.HERE_API_KEY;

type HerePlacesResponse = {
  items?: Array<{
    id?: string;
    title?: string;
    position?: { lat: number; lng: number };
    address?: { label?: string };
    distance?: number;
    categories?: Array<{ name?: string }>;
  }>;
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
    const at = searchParams.get("at");
    const query = searchParams.get("query");
    const limit = searchParams.get("limit") || "6";

    if (!at || !query) {
      return NextResponse.json(
        { success: false, error: "at and query are required." },
        { status: 400 }
      );
    }

    const url = new URL("https://discover.search.hereapi.com/v1/discover");
    url.searchParams.set("at", at);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", limit);
    url.searchParams.set("apiKey", HERE_API_KEY);

    const res = await fetch(url, { cache: "no-store", headers: hereHeaders });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `HERE places failed: ${res.status} ${text}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as HerePlacesResponse;

    return NextResponse.json({
      success: true,
      items: (data.items || []).map((item) => ({
        id: item.id,
        title: item.title,
        position: item.position,
        address: item.address?.label,
        distance: item.distance,
        categories: item.categories?.map((c) => c.name).filter(Boolean) || [],
      })),
    });
  } catch (error) {
    console.error("POI fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load POIs." },
      { status: 500 }
    );
  }
}
