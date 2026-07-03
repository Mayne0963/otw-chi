import { NextResponse } from 'next/server';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: URL, headers: Record<string, string>, maxAttempts = 3): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url.toString(), {
      headers,
      cache: 'force-cache',
      next: { revalidate: 300 },
    });
    lastResponse = response;

    if (response.ok) {
      return response;
    }

    const isRetryable = response.status === 429 || response.status === 503;
    if (!isRetryable || attempt >= maxAttempts) {
      return response;
    }

    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
    const retryMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : 1200 * attempt;
    await sleep(retryMs);
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw new Error('Nominatim request failed before receiving a response');
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query) {
      return new NextResponse('Query is required', { status: 400 });
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    // Copy all search params from the request to the Nominatim URL
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
    
    // Ensure format is json
    if (!url.searchParams.has('format')) {
      url.searchParams.append('format', 'json');
    }

    if (!url.searchParams.has('countrycodes')) {
      url.searchParams.append('countrycodes', 'us');
    }

    if (!url.searchParams.has('accept-language')) {
      url.searchParams.append('accept-language', 'en-US');
    }

    const response = await fetchWithRetry(
      url,
      {
        'User-Agent': 'OTW-Delivery-App',
        'Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://otw-delivery.com',
      }
    );

    if (!response.ok) {
      return new NextResponse(`Nominatim API Error: ${response.status}`, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Geocoding proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
