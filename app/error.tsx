'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

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
      <Card className="max-w-md w-full text-center border-red-500/20 bg-red-950/10">
        <CardHeader>
          <CardTitle className="text-red-500">Something went wrong!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm opacity-80">
            We encountered an unexpected error. Please try again later.
          </p>
          {error.digest && (
            <p className="text-xs font-mono bg-black/20 p-2 rounded text-red-200">
              Error ID: {error.digest}
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <Button onClick={() => reset()} variant="default">
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
