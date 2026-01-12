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
