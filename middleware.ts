import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';
import { getServerCapabilities } from '@/lib/capabilities';
import { serverFeatureFlags } from '@/lib/featureFlags';

function matchesPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

const NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth';
const LEGACY_AUTH_COOKIE_PREFIXES = ['__clerk', '__Secure-clerk', '__Host-clerk'];
const LEGACY_AUTH_COOKIE_NAMES = new Set([
  '__session',
  '__client_uat',
  '__clerk_db_jwt',
  '__clerk_handshake',
  '__clerk_redirect_count',
  '__clerk_redirect_url',
  '__clerk_invitation_token',
  '__clerk_telemetry',
  '__clerk_last_active_token',
]);

function getRequestCookieNames(req: NextRequest): string[] {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return [];

  return cookieHeader
    .split(';')
    .map((entry) => entry.trim().split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name));
}

function hasNeonAuthCookie(req: NextRequest): boolean {
  const names = getRequestCookieNames(req);
  return names.some((name) => name.startsWith(NEON_AUTH_COOKIE_PREFIX));
}

function getLegacyAuthCookiesToClear(req: NextRequest): string[] {
  const names = getRequestCookieNames(req);
  return names.filter((name) => {
    if (name.startsWith(NEON_AUTH_COOKIE_PREFIX)) return false;
    if (LEGACY_AUTH_COOKIE_NAMES.has(name)) return true;
    return LEGACY_AUTH_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix));
  });
}

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
    '/app-error',
    '/driver/apply',
    '/privacy',
    '/terms',
    '/design-system',
    '/api/stripe/webhook',
    '/api/client-error',
  ];
  if (publicPaths.includes(pathname)) return true;
  if (matchesPath(pathname, '/sign-in')) return true;
  if (matchesPath(pathname, '/sign-up')) return true;
  if (matchesPath(pathname, '/order')) return true;
  if (matchesPath(pathname, '/request')) return true;
  if (matchesPath(pathname, '/franchise')) return true;
  if (matchesPath(pathname, '/cities')) return true;
  if (matchesPath(pathname, '/auth')) return true;
  if (matchesPath(pathname, '/api/webhooks')) return true;
  if (matchesPath(pathname, '/api/auth')) return true;
  if (matchesPath(pathname, '/api/debug')) return true;
  // Driver endpoints enforce auth in their route handlers. Bypass edge auth
  // middleware here to avoid false 401s on authenticated POST polling calls.
  if (pathname === '/api/driver/location') return true;
  if (matchesPath(pathname, '/api/driver/navigation')) return true;
  // Order confirmation/dispute endpoints enforce ownership + auth in handlers.
  // Bypass edge auth here to avoid false unauthenticated responses from middleware.
  if (matchesPath(pathname, '/api/delivery-request')) return true;
  // Public API routes
  if (matchesPath(pathname, '/api/stripe')) return true;
  if (matchesPath(pathname, '/api/billing/overage/close-period')) return true;
  if (matchesPath(pathname, '/api/navigation')) return true;
  if (matchesPath(pathname, '/api/geocoding')) return true;
  if (matchesPath(pathname, '/api/otw/estimate')) return true;
  if (matchesPath(pathname, '/api/orders')) return true;
  if (matchesPath(pathname, '/api/orders/draft')) return true;
  if (matchesPath(pathname, '/api/orders/search')) return true;
  if (matchesPath(pathname, '/api/app-version')) return true;
  if (matchesPath(pathname, '/api/storage')) return true;
  if (matchesPath(pathname, '/api/cron')) return true;
  if (matchesPath(pathname, '/api/route')) return true;
  if (matchesPath(pathname, '/api/optimize-stops')) return true;
  if (matchesPath(pathname, '/api/reference')) return true;
  if (matchesPath(pathname, '/api/ai')) return true;
  // Allow request APIs to bypass edge auth and enforce auth in route handlers (Node runtime)
  if (matchesPath(pathname, '/api/requests')) return true;
  // Tracking URLs are public
  if (pathname.includes('/tracking')) return true;
  return false;
};

const buildCorsHeaders = (
  origin: string | null,
  requestHeaders: Headers,
  requestOrigin: string,
) => {
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
  addOrigin(requestOrigin);

  if (process.env.VERCEL_URL) {
    addOrigin(`https://${process.env.VERCEL_URL}`);
  }

  // Local development convenience.
  allowedOrigins.add('http://localhost:3000');
  allowedOrigins.add('http://localhost:3001');
  allowedOrigins.add('http://127.0.0.1:3000');
  allowedOrigins.add('http://127.0.0.1:3001');

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

function isBlockedFeaturePath(pathname: string): boolean {
  const capabilities = getServerCapabilities({});

  if (
    (matchesPath(pathname, '/franchise') || matchesPath(pathname, '/admin/franchise')) &&
    !capabilities.canSeeFranchise
  ) {
    return true;
  }
  if (
    (matchesPath(pathname, '/wallet/nip') || matchesPath(pathname, '/admin/nip-ledger')) &&
    !capabilities.canSeeNip
  ) {
    return true;
  }
  if (matchesPath(pathname, '/admin/cities-zones') && !capabilities.canSeeAdminZones) {
    return true;
  }
  if (
    (matchesPath(pathname, '/pos') || matchesPath(pathname, '/admin/pos') || matchesPath(pathname, '/merchant')) &&
    !capabilities.canSeePos
  ) {
    return true;
  }
  if (matchesPath(pathname, '/admin/billing') && !capabilities.canSeeBilling) {
    return true;
  }

  const isReceiptPath =
    matchesPath(pathname, '/receipt') ||
    matchesPath(pathname, '/verify') ||
    matchesPath(pathname, '/veryfi') ||
    matchesPath(pathname, '/api/receipt') ||
    matchesPath(pathname, '/api/veryfi') ||
    matchesPath(pathname, '/api/admin/receipts');
  if (isReceiptPath && !serverFeatureFlags.receipts) {
    return true;
  }

  const isPickupPassPath =
    matchesPath(pathname, '/api/upload/pickup-pass') ||
    (matchesPath(pathname, '/api/requests') && pathname.includes('/pickup-pass'));
  if (isPickupPassPath && !serverFeatureFlags.pickupPass) {
    return true;
  }

  const isChatPath =
    matchesPath(pathname, '/api/requests') &&
    (pathname.includes('/messages') || pathname.includes('/messages/read'));
  if (isChatPath && !serverFeatureFlags.chat) {
    return true;
  }

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith('/api');
  const legacyAuthCookiesToClear = getLegacyAuthCookiesToClear(req);
  const requestHasNeonAuthCookie = hasNeonAuthCookie(req);

  const finalizeResponse = (res: NextResponse): NextResponse => {
    if (legacyAuthCookiesToClear.length > 0) {
      const secure = req.nextUrl.protocol === 'https:';
      for (const cookieName of legacyAuthCookiesToClear) {
        res.cookies.set({
          name: cookieName,
          value: '',
          path: '/',
          maxAge: 0,
          expires: new Date(0),
          sameSite: 'lax',
          ...(secure ? { secure: true } : {}),
        });
      }
    }

    if (isApiRoute) {
      const origin = req.headers.get('origin');
      const corsHeaders = buildCorsHeaders(origin, req.headers, req.nextUrl.origin);
      if (corsHeaders) {
        Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
      }
    }

    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;
  };

  if (isBlockedFeaturePath(pathname)) {
    if (pathname.startsWith('/api')) {
      return finalizeResponse(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    }

    const notFoundUrl = req.nextUrl.clone();
    notFoundUrl.pathname = '/404';
    notFoundUrl.search = '';
    return finalizeResponse(NextResponse.rewrite(notFoundUrl));
  }

  const isServerActionRequest =
    req.method === 'POST' && req.headers.has('next-action');
  const isDriverServerActionRequest =
    isServerActionRequest &&
    (pathname === '/driver/dashboard' ||
      pathname === '/driver/jobs' ||
      pathname.startsWith('/driver/jobs/'));
  
  const isAdminServerActionRequest =
    isServerActionRequest &&
    pathname.startsWith('/admin/');
  
  // Handle CORS for API routes
  if (isApiRoute) {
    const origin = req.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin, req.headers, req.nextUrl.origin);

    if (req.method === 'OPTIONS') {
      return finalizeResponse(new NextResponse(null, {
        status: 204,
        headers: corsHeaders ?? undefined,
      }));
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

  // Some driver server-action submissions can be falsely classified as unauthenticated
  // by edge middleware, even with a valid cookie session. Let those requests reach the
  // action handler, where we enforce auth again.
  if (
    isDriverServerActionRequest &&
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get('location')?.includes('/sign-in')
  ) {
    const bypassResponse = NextResponse.next();
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      bypassResponse.headers.set('set-cookie', setCookie);
    }
    response = bypassResponse;
  }

  // Admin server actions can also be falsely classified as unauthenticated by edge middleware.
  // Let those requests reach the action handler, where we enforce auth again.
  if (
    isAdminServerActionRequest &&
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get('location')?.includes('/sign-in')
  ) {
    const bypassResponse = NextResponse.next();
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      bypassResponse.headers.set('set-cookie', setCookie);
    }
    response = bypassResponse;
  }

  // Request APIs can be falsely classified as unauthenticated by edge middleware.
  // Let these requests reach Node route handlers, which enforce auth reliably.
  if (
    matchesPath(pathname, '/api/requests') &&
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get('location')?.includes('/sign-in')
  ) {
    const bypassResponse = NextResponse.next();
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      bypassResponse.headers.set('set-cookie', setCookie);
    }
    response = bypassResponse;
  }

  // API routes with a Neon auth cookie should be handled by route handlers even if
  // edge middleware cannot resolve the session and returns sign-in redirect/401/403.
  if (
    isApiRoute &&
    !isPublicRoute(pathname) &&
    requestHasNeonAuthCookie &&
    (
      response.status === 401 ||
      response.status === 403 ||
      (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')?.includes('/sign-in')
      )
    )
  ) {
    const bypassResponse = NextResponse.next();
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      bypassResponse.headers.set('set-cookie', setCookie);
    }
    response = bypassResponse;
  }

  // Public-route server actions can be falsely classified as unauthenticated by edge auth.
  // Let the server action handler enforce auth instead of forcing a sign-in redirect.
  if (
    isServerActionRequest &&
    isPublicRoute(pathname) &&
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get('location')?.includes('/sign-in')
  ) {
    const bypassResponse = NextResponse.next();
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      bypassResponse.headers.set('set-cookie', setCookie);
    }
    response = bypassResponse;
  }

  // Next.js server actions expect an RSC payload or an `x-action-redirect` header.
  // Neon auth middleware returns a regular HTTP redirect for unauthenticated requests,
  // which causes Next to throw "An unexpected response was received from the server."
  // Convert auth redirects on server-action POSTs into action redirects.
  if (
    isServerActionRequest &&
    !isPublicRoute(pathname) &&
    response.status >= 300 &&
    response.status < 400
  ) {
    const location = response.headers.get('location');
    if (location) {
      const target = new URL(location, req.url);
      const actionRedirect = new NextResponse(null, { status: 303 });
      actionRedirect.headers.set(
        'x-action-redirect',
        `${target.pathname}${target.search}${target.hash};replace`
      );

      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        actionRedirect.headers.set('set-cookie', setCookie);
      }

      return finalizeResponse(actionRedirect);
    }
  }

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
    return finalizeResponse(unauthorized);
  }

  // Handle Public Routes:
  // If the auth middleware enforces auth on a public route (redirect or 401/403),
  // override it to allow the request through while preserving any set-cookie headers.
  // Do not suppress auth API route behavior (callbacks/session endpoints).
  const shouldBypassPublicAuth =
    isPublicRoute(pathname) &&
    !matchesPath(pathname, '/api/auth') &&
    ((response.status >= 300 && response.status < 400) || response.status === 401 || response.status === 403);

  if (shouldBypassPublicAuth) {
    // Do not suppress redirects for auth API routes (like callbacks)
    if (matchesPath(pathname, '/api/auth')) {
      return finalizeResponse(response);
    }

    const newResponse = NextResponse.next();
    
    // Preserve headers from the auth middleware response (e.g. Set-Cookie)
    response.headers.forEach((value, key) => {
      newResponse.headers.set(key, value);
    });
    
    response = newResponse;
  }

  return finalizeResponse(response);
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
