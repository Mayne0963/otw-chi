import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/pricing',
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
]);

const isDriverRoute = createRouteMatcher(['/driver(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

  const session = await auth.protect();

  const claims = session.sessionClaims as { publicMetadata?: { role?: string }; metadata?: { role?: string }; otw?: { role?: string } } | undefined;
  const role = String(
    claims?.publicMetadata?.role ?? claims?.metadata?.role ?? claims?.otw?.role ?? ''
  ).toUpperCase();

  if (isAdminRoute(req) && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (isDriverRoute(req) && !(role === 'DRIVER' || role === 'ADMIN')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|.*\\..*).*)',
    '/(api|trpc)(.*)',
  ],
};
