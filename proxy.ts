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
  '/order',
  '/request',
  '/privacy',
  '/terms',
  '/franchise(.*)',
  '/cities(.*)',
  '/api/stripe/webhook',
  '/api/webhooks/(.*)',
  '/api/debug/(.*)',
]);

const isDriverRoute = createRouteMatcher(['/driver(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

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
      console.log(`[Middleware] Access denied to admin route. User role: ${role}`);
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Check driver route access (drivers and admins can access)
    if (isDriverRoute(req) && !(role === 'DRIVER' || role === 'ADMIN')) {
      console.log(`[Middleware] Access denied to driver route. User role: ${role}`);
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
