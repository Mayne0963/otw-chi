import { NextResponse } from "next/server";
import { parseHereRoute, parseHereAlternatives } from "@/lib/navigation/here";

const HERE_API_KEY = process.env.HERE_API_KEY;

const buildHereRouteUrl = (params: {
  origin: string;
  destination: string;
  alternatives?: number;
  lang?: string;
}) => {
  const url = new URL("https://router.hereapi.com/v8/routes");
  url.searchParams.set("transportMode", "car");
  url.searchParams.set("origin", params.origin);
  url.searchParams.set("destination", params.destination);
  url.searchParams.set("return", "summary,polyline,actions,instructions,spans");
  url.searchParams.set("spans", "speedLimit,baseDuration,trafficDelay");
  url.searchParams.set("routingMode", "fast");
  url.searchParams.set("traffic", "enabled");
  if (params.alternatives && params.alternatives > 0) {
    url.searchParams.set("alternatives", String(params.alternatives));
  }
  if (params.lang) {
    url.searchParams.set("lang", params.lang);
  }
  if (HERE_API_KEY) {
    url.searchParams.set("apiKey", HERE_API_KEY);
  }
  return url.toString();
};

export async function GET(request: Request) {
  try {
    if (!HERE_API_KEY) {
      return NextResponse.json(
        { success: false, error: "HERE_API_KEY is not configured." },
        { status: 500 }
      );
    }

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

    const url = buildHereRouteUrl({ origin, destination, alternatives, lang });
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `HERE route failed: ${res.status} ${text}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as unknown;
    const route = parseHereRoute(data as any);
    if (!route) {
      return NextResponse.json(
        { success: false, error: "Unable to parse HERE route response." },
        { status: 500 }
      );
    }
    const alternativesParsed = parseHereAlternatives(data as any);

    return NextResponse.json({
      success: true,
      route,
      alternatives: alternativesParsed,
    });
  } catch (error) {
    console.error("Navigation route error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to fetch navigation route." },
      { status: 500 }
    );
  }
}
