import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';
import { NextResponse, NextRequest } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/how-it-works',
  '/pricing',
  '/services',
  '/cities',
  '/cities/(.*)',
  '/franchise',
  '/franchise/apply',
  '/driver/apply',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/api/(.*)',
]);

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !!process.env.CLERK_PUBLISHABLE_KEY;

const driverRoute = createRouteMatcher(['/driver(.*)']);
const adminRoute = createRouteMatcher(['/admin(.*)']);
const franchiseRoute = createRouteMatcher(['/franchise(.*)']);

const proxy = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();
  
  // Role-based protection logic
  if (driverRoute(req) || adminRoute(req) || franchiseRoute(req)) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(session.userId);
      const role = String(user.publicMetadata?.role || '').toUpperCase();
      
      if (driverRoute(req) && !(role === 'DRIVER' || role === 'ADMIN')) {
        return NextResponse.redirect(new URL('/', req.url));
      }
      if (adminRoute(req) && role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/', req.url));
      }
      if (franchiseRoute(req) && !(role === 'FRANCHISE' || role === 'ADMIN')) {
        return NextResponse.redirect(new URL('/', req.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
  return NextResponse.next();
});

const noop = (_req: NextRequest) => NextResponse.next();

export default HAS_CLERK ? proxy : noop;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
