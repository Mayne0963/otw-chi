'use client';

import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen bg-otwBlack text-otwOffWhite antialiased flex items-center justify-center">
        <OtwCard className="max-w-md w-full text-center space-y-4 m-4">
          <h2 className="text-xl font-bold text-red-500">Critical System Error</h2>
          <p className="text-sm opacity-80">
            A critical error occurred. Please refresh the page.
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
      </body>
    </html>
  );
}
