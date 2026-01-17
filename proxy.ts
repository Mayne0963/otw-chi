import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
	'/',
	'/sign-in(.*)',
	'/sign-up(.*)',
	'/pricing',
	'/about',
	'/how-it-works',
	'/services',
	'/contact',
	'/driver/apply',
	'/order(.*)',
	'/request(.*)',
	'/privacy',
	'/terms',
	'/franchise(.*)',
	'/cities(.*)',
	'/design-system',
	'/api/stripe/webhook',
	'/api/webhooks(.*)',
	'/api/webhooks/(.*)',
	'/api/debug/(.*)',
]);

const isDriverRoute = createRouteMatcher(['/driver(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

const isApiRoute = createRouteMatcher(['/api(.*)']);

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

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

  if (isApiRoute(req)) {
    const origin = req.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin, req.headers);

    // Let route handlers enforce auth; avoid Clerk protect redirects for API fetches.
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

  const session = await auth.protect();
  const userId = session.userId;

  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // For admin and driver routes, we need to check the role
  if (isAdminRoute(req) || isDriverRoute(req)) {
    let role = '';

    try {
      // Fetch the user's role from Clerk's publicMetadata
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      role = String(user.publicMetadata?.role || '').toUpperCase();
    } catch (error) {
      console.error('[Middleware] Failed to fetch user role:', error);
      // If we can't fetch the role, deny access to protected routes
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Check admin route access
    if (isAdminRoute(req) && role !== 'ADMIN') {
      // console.log(`[Middleware] Access denied to admin route. User role: ${role}`);
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Check driver route access (drivers and admins can access)
    if (isDriverRoute(req) && !(role === 'DRIVER' || role === 'ADMIN')) {
      // console.log(`[Middleware] Access denied to driver route. User role: ${role}`);
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|.*\\..*).*)',
    '/(api|trpc)(.*)',
  ],
};
