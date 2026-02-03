import { NextResponse } from 'next/server';

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

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'OTW-Delivery-App',
        'Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://otw-delivery.com',
      },
    });

    if (!response.ok) {
      return new NextResponse(`Nominatim API Error: ${response.status}`, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Geocoding proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
