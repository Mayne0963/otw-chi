'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';

type RequestPaymentSyncProps = {
  requestId: string;
  checkoutSuccess: boolean;
  sessionId?: string;
  freeCheckout?: boolean;
};

type DeliveryVerifyPayload = {
  paid?: boolean;
  synced?: boolean;
  error?: string;
};

export default function RequestPaymentSync({
  requestId,
  checkoutSuccess,
  sessionId,
  freeCheckout = false,
}: RequestPaymentSyncProps) {
  const router = useRouter();
  const [synced, setSynced] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!checkoutSuccess || synced) return;

    if (freeCheckout && !sessionId) {
      router.refresh();
      router.replace(`/requests/${requestId}`);
      toast({
        title: 'Payment confirmed',
        description: 'Your request is ready for dispatch.',
      });
      return;
    }

    if (!sessionId) return;

    const syncPayment = async () => {
      try {
        const res = await fetch('/api/stripe/delivery-verify', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!res.ok) {
          return false;
        }

        const payload = (await res.json()) as DeliveryVerifyPayload;
        if (payload.paid && payload.synced) {
          setSynced(true);
          router.refresh();
          router.replace(`/requests/${requestId}`);
          toast({
            title: 'Payment confirmed',
            description: 'Your request is ready for dispatch.',
          });
          return true;
        }
      } catch (error) {
        console.error('Failed to sync delivery payment:', error);
      }

      return false;
    };

    const timer = setTimeout(() => {
      void syncPayment().then((done) => {
        if (!done && pollCount < 5) {
          setPollCount((current) => current + 1);
          return;
        }
        if (!done && pollCount >= 5) {
          toast({
            title: 'Payment processing',
            description: 'Your request should update shortly. Refresh if needed.',
          });
        }
      });
    }, pollCount === 0 ? 800 : 1500);

    return () => clearTimeout(timer);
  }, [checkoutSuccess, synced, freeCheckout, sessionId, requestId, router, pollCount]);

  return null;
}
