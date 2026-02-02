import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isPublicRoute = (pathname: string) => {
  const publicPaths = [
    '/',
    '/sign-in',
    '/sign-up',
    '/pricing',
    '/about',
    '/how-it-works',
    '/services',
    '/contact',
    '/driver/apply',
    '/privacy',
    '/terms',
    '/design-system',
    '/api/stripe/webhook',
  ];
  if (publicPaths.includes(pathname)) return true;
  if (pathname.startsWith('/order')) return true;
  if (pathname.startsWith('/request')) return true;
  if (pathname.startsWith('/franchise')) return true;
  if (pathname.startsWith('/cities')) return true;
  if (pathname.startsWith('/api/webhooks')) return true;
  if (pathname.startsWith('/api/debug')) return true;
  return false;
};

const buildCorsHeaders = (origin: string | null, requestHeaders: Headers) => {
  if (!origin) return null;

  const allowedOrigins = new Set<string>();
  const addOrigin = (value?: string) => {
    if (!value) return;
    try {
      allowedOrigins.add(new URL(value).origin);
    } catch {
      // Ignore invalid URL env values.
    }
  };

  addOrigin(process.env.NEXT_PUBLIC_APP_URL);

  if (process.env.VERCEL_URL) {
    addOrigin(`https://${process.env.VERCEL_URL}`);
  }

  // Local development convenience.
  allowedOrigins.add('http://localhost:3000');
  allowedOrigins.add('http://127.0.0.1:3000');

  if (!allowedOrigins.has(origin)) return null;

  const allowHeaders =
    requestHeaders?.get('access-control-request-headers') ??
    'Content-Type, Authorization';

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': allowHeaders,
    'access-control-max-age': '86400',
    vary: 'Origin',
  } satisfies Record<string, string>;
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Handle CORS for API routes
  if (pathname.startsWith('/api')) {
    const origin = req.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin, req.headers);

    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders ?? undefined,
      });
    }

    const res = NextResponse.next();
    if (corsHeaders) {
      for (const [key, value] of Object.entries(corsHeaders)) {
        res.headers.set(key, value);
      }
    }
    return res;
  }
  
  // For now, we rely on page-level auth checks as Neon Auth middleware support is TBD
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
