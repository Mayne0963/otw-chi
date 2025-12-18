'use client';

import { useEffect } from 'react';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
      <OtwCard className="max-w-md w-full text-center space-y-4">
        <h2 className="text-xl font-bold text-red-500">Something went wrong!</h2>
        <p className="text-sm opacity-80">
          We encountered an unexpected error. Please try again later.
        </p>
        {error.digest && (
          <p className="text-xs font-mono bg-black/20 p-2 rounded">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex justify-center pt-2">
          <OtwButton onClick={() => reset()} variant="gold">
            Try again
          </OtwButton>
        </div>
      </OtwCard>
    </div>
  );
}
