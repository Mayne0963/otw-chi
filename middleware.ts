import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
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

const handler = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();
  return NextResponse.next();
});

const noop = (_req: NextRequest) => NextResponse.next();

export default HAS_CLERK ? handler : noop;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
