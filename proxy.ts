import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  const session = await auth();
  if (!session.userId) {
    return session.redirectToSignIn();
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

