'use client';

import { useEffect } from 'react';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwCard from '@/components/ui/otw/OtwCard';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    const digest = error?.digest;
    const href = typeof window !== 'undefined' ? window.location.href : null;

    try {
      const key = digest ? `otw:error:${digest}` : `otw:error:${href ?? ''}:${error?.name ?? ''}:${error?.message ?? ''}`;
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(key)) return;
      if (typeof window !== 'undefined') window.sessionStorage.setItem(key, '1');
    } catch {
      // ignore
    }

    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        digest: digest ?? null,
        name: error?.name ?? null,
        message: error?.message ?? null,
        stack: error?.stack ?? null,
        href,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 bg-otwBlack">
      <OtwCard className="max-w-md w-full text-center border-red-500/20 bg-red-950/10">
        <div className="p-6">
          <h2 className="text-xl font-bold text-red-500 mb-4">Something went wrong!</h2>
          <div className="space-y-4">
            <p className="text-sm text-white/80">
              We encountered an unexpected error. Please try again later.
            </p>
            {error.digest && (
              <p className="text-xs font-mono bg-black/20 p-2 rounded text-red-200">
                Error ID: {error.digest}
              </p>
            )}
            <div className="pt-2">
              <OtwButton onClick={() => reset()} variant="red">
                Try again
              </OtwButton>
            </div>
          </div>
        </div>
      </OtwCard>
    </div>
  );
}
