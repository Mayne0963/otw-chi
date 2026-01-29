'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';

export function BillingSync({ success }: { success?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [synced, setSynced] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!success || synced) return;

    const syncBilling = async () => {
      try {
        // We use GET to just check status (lightweight)
        // We use POST if we want to force a Stripe pull (heavier)
        // The instructions say "poll /api/billing/sync" which implies checking status
        const res = await fetch(`/api/billing/sync?session_id=${sessionId || ''}`, { method: 'GET' });
        
        if (res.ok) {
          const data = await res.json();
          if (data.active) {
              setSynced(true);
              router.refresh();
              toast({
                  title: "Membership Active",
                  description: `You have ${data.balanceMiles} Service Miles available.`,
              });
              return true; // Done
          }
        }
      } catch (err) {
        console.error('Failed to check billing status:', err);
      }
      return false; // Not yet active
    };

    const runPoll = async () => {
        const isDone = await syncBilling();
        if (!isDone && pollCount < 5) {
            // Poll again in 2s
            setTimeout(() => setPollCount(prev => prev + 1), 2000);
        } else if (!isDone && pollCount >= 5) {
            toast({
                title: "Processing Payment",
                description: "Your miles will appear shortly. Please refresh the page.",
            });
        }
    };

    // Initial delay
    const timer = setTimeout(() => {
        if (pollCount === 0) {
             toast({ title: "Verifying Membership...", description: "Please wait while we activate your account." });
        }
        runPoll();
    }, 1000);

    return () => clearTimeout(timer);
  }, [success, synced, router, sessionId, pollCount]);

  return null;
}
