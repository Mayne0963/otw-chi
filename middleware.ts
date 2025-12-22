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
  '/api/stripe/webhook',
  '/api/webhooks(.*)',
  '/terms',
  '/privacy'
]);

// Explicitly protected routes (optional, as we protect everything else by default)
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/membership(.*)',
  '/wallet(.*)',
  '/settings(.*)',
  '/support(.*)',
  '/requests(.*)',
  '/driver/dashboard(.*)',
  '/driver/jobs(.*)',
  '/driver/earnings(.*)',
  '/admin(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protect all other routes
  await auth.protect();

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
