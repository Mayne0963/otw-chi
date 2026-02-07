import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';

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
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname.startsWith('/api/debug')) return true;
  // Public API routes
  if (pathname.startsWith('/api/stripe')) return true;
  if (pathname.startsWith('/api/navigation')) return true;
  if (pathname.startsWith('/api/geocoding')) return true;
  if (pathname.startsWith('/api/otw/estimate')) return true;
  if (pathname.startsWith('/api/orders/search')) return true;
  if (pathname.startsWith('/api/requests') && pathname.includes('/tracking')) return true;
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
  const isApiRoute = pathname.startsWith('/api');
  
  // Handle CORS for API routes
  if (isApiRoute) {
    const origin = req.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin, req.headers);

    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders ?? undefined,
      });
    }

    // Continue to auth middleware for API routes, but we'll attach CORS headers later
    // or let the auth middleware handle the response and we might miss CORS headers.
    // Ideally, we wrap the response.
  }
  
  // Use Neon Auth Middleware
  // It handles session refreshing and optional redirection
  const authMiddleware = auth.middleware({
    loginUrl: '/sign-in',
  });

  // Execute auth middleware for all routes (except static/_next handled by matcher)
  let response = await authMiddleware(req);

  // API routes should never redirect to HTML sign-in pages.
  // Return a 401 so client fetch calls can handle auth state explicitly.
  if (
    isApiRoute &&
    !isPublicRoute(pathname) &&
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get('location')?.includes('/sign-in')
  ) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const origin = req.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin, req.headers);
    if (corsHeaders) {
      Object.entries(corsHeaders).forEach(([k, v]) => unauthorized.headers.set(k, v));
    }
    return unauthorized;
  }

  // Handle Public Routes:
  // If the auth middleware tries to redirect (enforce auth) on a public route,
  // we override it to allow access (returning the original request flow).
  // This allows the page to render for unauthenticated users, while still
  // allowing the middleware to set session headers for authenticated users.
  if (isPublicRoute(pathname) && response.status >= 300 && response.status < 400) {
    // Do not suppress redirects for auth API routes (like callbacks)
    if (pathname.startsWith('/api/auth')) {
      return response;
    }

    const newResponse = NextResponse.next();
    
    // Preserve headers from the auth middleware response (e.g. Set-Cookie)
    response.headers.forEach((value, key) => {
      newResponse.headers.set(key, value);
    });
    
    response = newResponse;
  }

  // Re-attach CORS headers if it was an API request
  if (isApiRoute) {
    const origin = req.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin, req.headers);
    if (corsHeaders) {
        Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    }
  }

  return response;
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
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
