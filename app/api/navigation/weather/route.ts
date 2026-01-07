import { NextResponse } from "next/server";

const HERE_API_KEY = process.env.HERE_API_KEY;

type HereWeatherResponse = {
  observations?: {
    location?: Array<{
      observation?: Array<{
        temperature?: number;
        description?: string;
        precipitationDesc?: string;
        precipitationIntensity?: number;
        visibility?: number;
        windSpeed?: number;
        windDirection?: number;
        humidity?: number;
        icon?: number;
      }>;
    }>;
  };
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
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!lat || !lng) {
      return NextResponse.json(
        { success: false, error: "lat and lng are required." },
        { status: 400 }
      );
    }

    const url = new URL("https://weather.ls.hereapi.com/weather/1.0/report.json");
    url.searchParams.set("apiKey", HERE_API_KEY);
    url.searchParams.set("product", "observation");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lng);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { success: false, error: `HERE weather failed: ${res.status} ${text}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as HereWeatherResponse;
    const observation = data.observations?.location?.[0]?.observation?.[0];

    if (!observation) {
      return NextResponse.json(
        { success: false, error: "No weather observation found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      weather: {
        temperature: observation.temperature,
        description: observation.description,
        precipitationDesc: observation.precipitationDesc,
        precipitationIntensity: observation.precipitationIntensity,
        visibility: observation.visibility,
        windSpeed: observation.windSpeed,
        windDirection: observation.windDirection,
        humidity: observation.humidity,
        icon: observation.icon,
      },
    });
  } catch (error) {
    console.error("Weather fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to load weather." },
      { status: 500 }
    );
  }
}
