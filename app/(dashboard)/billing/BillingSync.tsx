'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function BillingSync({ success }: { success?: boolean }) {
  const router = useRouter();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!success || synced) return;

    const syncBilling = async () => {
      try {
        const res = await fetch('/api/billing/sync', { method: 'POST' });
        if (res.ok) {
          setSynced(true);
          router.refresh();
        }
      } catch (err) {
        console.error('Failed to sync billing:', err);
      }
    };

    // Small delay to ensure Stripe has processed the event if webhook was slow
    const timer = setTimeout(() => {
        syncBilling();
    }, 1000);

    return () => clearTimeout(timer);
  }, [success, synced, router]);

  return null; // This component is invisible logic
}
