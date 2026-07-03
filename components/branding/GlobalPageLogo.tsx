'use client';

import { usePathname } from 'next/navigation';
import OtwBrandLink from '@/components/branding/OtwBrandLink';

function matchesRoute(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

const handledRoutePrefixes = [
  '/pricing',
  '/how-it-works',
  '/contact',
  '/about',
  '/privacy',
  '/terms',
  '/cities',
  '/order',
  '/ride',
  '/design-system',
  '/driver/apply',
  '/dashboard',
  '/requests',
  '/membership',
  '/onboarding',
  '/billing',
  '/service-miles',
  '/wallet',
  '/support',
  '/settings',
  '/pay',
  '/cache',
  '/franchise',
  '/driver/dashboard',
  '/driver/earnings',
  '/driver/profile',
  '/driver/founder-log',
  '/driver/jobs',
  '/driver/zones',
  '/driver/requests',
  '/admin',
  '/sign-in',
  '/sign-up',
  '/auth',
];

export default function GlobalPageLogo() {
  const pathname = usePathname();
  if (!pathname) return null;

  const hasDedicatedLogo =
    pathname === '/' || handledRoutePrefixes.some((prefix) => matchesRoute(pathname, prefix));

  if (hasDedicatedLogo) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-4 top-4 z-50">
      <OtwBrandLink
        className="pointer-events-auto border border-white/10 bg-black/45 pr-4 backdrop-blur-xl"
        imageClassName="h-11 w-11 rounded-lg"
        labelClassName="hidden text-sm tracking-[0.28em] text-white sm:block"
      />
    </div>
  );
}
