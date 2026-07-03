import { NextResponse } from "next/server";
import { getHereRequestHeaderCandidates, requireHereApiKey } from "@/lib/navigation/hereEnv";

type HerePlacesResponse = {
  items?: Array<{
    id?: string;
    title?: string;
    position?: { lat: number; lng: number };
    address?: {
      label?: string;
      houseNumber?: string;
      street?: string;
      city?: string;
      stateCode?: string;
      state?: string;
      postalCode?: string;
    };
    distance?: number;
    categories?: Array<{ name?: string }>;
  }>;
};

export async function GET(request: Request) {
  try {
    const HERE_API_KEY = requireHereApiKey();

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

    let res: Response | null = null;
    let responseText = "";
    for (const headers of getHereRequestHeaderCandidates(request)) {
      const attempt = await fetch(url, { cache: "no-store", headers });
      if (attempt.ok) {
        res = attempt;
        break;
      }

      responseText = await attempt.text().catch(() => "");
      res = attempt;

      // Retry with the next header candidate only for auth-style failures.
      if (attempt.status !== 401 && attempt.status !== 403) {
        break;
      }
    }

    if (!res) {
      return NextResponse.json(
        { success: false, error: "HERE places failed before receiving a response." },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `HERE places failed: ${res.status} ${responseText}` },
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
        streetAddress: [item.address?.houseNumber, item.address?.street].filter(Boolean).join(" ").trim() || undefined,
        city: item.address?.city,
        state: item.address?.stateCode || item.address?.state,
        zipCode: item.address?.postalCode,
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
