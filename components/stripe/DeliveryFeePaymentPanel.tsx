'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import StripePaymentForm from '@/components/stripe/StripePaymentForm';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

type DeliveryIntentResponse = {
  alreadyPaid?: boolean;
  clientSecret?: string | null;
  paymentIntentId?: string | null;
  amountCents?: number;
  error?: string;
  message?: string;
  details?: unknown;
};

type DeliveryFeePaymentPanelProps = {
  deliveryRequestId: string;
  amountCents: number;
};

export default function DeliveryFeePaymentPanel({
  deliveryRequestId,
  amountCents,
}: DeliveryFeePaymentPanelProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number | null; message: string } | null>(null);

  const loadClientSecret = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/create-delivery-payment-intent', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveryRequestId,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as DeliveryIntentResponse;

      if (!res.ok) {
        const baseMessage = payload.error || payload.message || 'Unable to initialize delivery payment';
        const details = typeof payload.details === 'string' && payload.details.trim().length > 0
          ? payload.details.trim()
          : null;
        const message = details ? `${baseMessage} (${details})` : baseMessage;
        const loadError = { status: res.status, message };
        setError(loadError);
        toast({
          title: 'Payment setup failed',
          description: `Error ${res.status}: ${message}`,
          variant: 'destructive',
        });
        return;
      }

      if (payload.alreadyPaid) {
        toast({
          title: 'Already paid',
          description: 'This request has already been paid.',
        });
        router.replace(`/request/${deliveryRequestId}`);
        return;
      }

      if (!payload.clientSecret) {
        throw new Error('Stripe did not return a payment form');
      }

      setClientSecret(payload.clientSecret);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to initialize delivery payment';
      setError({ status: null, message });
      toast({
        title: 'Payment setup failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [deliveryRequestId, router, toast]);

  useEffect(() => {
    void loadClientSecret();
  }, [loadClientSecret]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/70">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing secure payment form...
      </div>
    );
  }

  if (error || !clientSecret) {
    const statusLabel = error?.status !== null && error?.status !== undefined ? String(error.status) : 'Unknown';
    const errorMessage = error?.message ?? 'Unable to load payment form.';

    return (
      <div className="space-y-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        <div className="space-y-1">
          <div className="font-semibold">Error {statusLabel}</div>
          <div>{errorMessage}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void loadClientSecret()}>
            Retry
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push(`/request/${deliveryRequestId}`)}>
            Back to Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <StripePaymentForm
      amountCents={amountCents}
      initialClientSecret={clientSecret}
      returnPath={`/pay/${deliveryRequestId}`}
      onSuccess={() => {
        toast({
          title: 'Payment successful',
          description: 'Your request is now ready for dispatch.',
        });
        router.push(`/request/${deliveryRequestId}`);
      }}
      onError={(paymentError) => {
        toast({
          title: 'Payment failed',
          description: paymentError,
          variant: 'destructive',
        });
      }}
    />
  );
}
