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

    // Continue to auth middleware for API routes, but we'll attach CORS headers later
    // or let the auth middleware handle the response and we might miss CORS headers.
    // Ideally, we wrap the response.
  }
  
  // Use Neon Auth Middleware
  // It handles session refreshing and optional redirection
  const authMiddleware = auth.middleware({
    loginUrl: '/sign-in',
    // We can allow public routes to pass through without redirecting
    // But neonAuth.middleware usually redirects if not authenticated?
    // Let's check if we can conditionalize it.
    // Actually, we should only run it if we want to enforce auth OR refresh session.
    // For now, let's run it globally but be careful about public routes.
    // If we want to allow public access, we might need to check isPublicRoute.
  });

  // If it's a public route, we might skip enforcement but still run it for session refresh?
  // If neonAuth.middleware enforces auth, we must skip it for public routes.
  // Documentation says: "Protects routes from unauthenticated requests"
  
  if (isPublicRoute(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/static')) {
     const res = NextResponse.next();
     // Add CORS if needed
     if (pathname.startsWith('/api')) {
        const origin = req.headers.get('origin');
        const corsHeaders = buildCorsHeaders(origin, req.headers);
        if (corsHeaders) {
            Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
        }
     }
     return res;
  }

  const response = await authMiddleware(req);
  
  // Re-attach CORS headers if it was an API request
  if (pathname.startsWith('/api')) {
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
