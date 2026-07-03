'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackOtwEvent } from '@/lib/analytics/otwTrack';

function safeReferrerPath(): string | null {
  try {
    if (!document.referrer) return null;
    const url = new URL(document.referrer);
    return url.pathname;
  } catch {
    return null;
  }
}

export default function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith('/admin')) return; // avoid polluting customer metrics

    void trackOtwEvent('PAGE_VIEW', {
      page: pathname,
      metadata: {
        referrerPath: safeReferrerPath(),
      },
    });

    if (pathname.startsWith('/pricing') || pathname.startsWith('/membership')) {
      void trackOtwEvent('MEMBERSHIP_VIEW', { page: pathname });
    }
  }, [pathname]);

  return null;
}
