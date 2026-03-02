'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';

type RequestRatingPanelProps = {
  requestId: string;
  initialRating: number | null;
  canRate: boolean;
};

export default function RequestRatingPanel({
  requestId,
  initialRating,
  canRate,
}: RequestRatingPanelProps) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(initialRating);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submitRating = (nextRating: number) => {
    if (!canRate || isPending) return;

    setError(null);
    setSuccess(null);
    setRating(nextRating);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/requests/${requestId}/rating`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rating: nextRating }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            payload && typeof payload.error === 'string'
              ? payload.error
              : `Could not save rating (${response.status})`;
          throw new Error(message);
        }

        const savedRating =
          payload && typeof payload.rating === 'number' ? payload.rating : nextRating;
        setRating(savedRating);
        setSuccess('Rating saved. Thank you for your feedback.');
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save rating';
        setError(message);
      }
    });
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-medium text-white">Rate This Order</div>
      <p className="mt-1 text-xs text-white/60">
        Your feedback helps improve delivery quality. You can update your rating any time.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((value) => {
          const active = (rating ?? 0) >= value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => submitRating(value)}
              disabled={!canRate || isPending}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${
                active
                  ? 'border-otwGold/70 bg-otwGold/20 text-otwGold'
                  : 'border-white/15 bg-white/5 text-white/80 hover:border-otwGold/40 hover:text-otwGold'
              } ${isPending ? 'cursor-wait opacity-70' : ''}`}
              aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
            >
              <Star className={`h-3.5 w-3.5 ${active ? 'fill-current' : ''}`} />
              {value}
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-white/70">
        Current rating: {rating ?? 'Not rated yet'}
        {typeof rating === 'number' ? '/5' : ''}
      </div>

      {error ? <div className="mt-2 text-xs text-red-300">{error}</div> : null}
      {success ? <div className="mt-2 text-xs text-green-300">{success}</div> : null}
    </div>
  );
}
