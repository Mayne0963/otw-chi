'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import StripePaymentForm from '@/components/stripe/StripePaymentForm';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

type OverageIntentResponse = {
  alreadyPaid?: boolean;
  clientSecret?: string | null;
  paymentIntentId?: string | null;
  amountCents?: number;
  error?: string;
};

type OveragePaymentPanelProps = {
  deliveryRequestId: string;
  amountCents: number;
};

export default function OveragePaymentPanel({
  deliveryRequestId,
  amountCents,
}: OveragePaymentPanelProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [showCardForm, setShowCardForm] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClientSecret = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/create-overage-payment-intent', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveryRequestId,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as OverageIntentResponse;

      if (!res.ok) {
        throw new Error(payload.error || 'Unable to initialize overage payment');
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
      const message = loadError instanceof Error ? loadError.message : 'Unable to initialize overage payment';
      setError(message);
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
    if (!showCardForm) return;
    void loadClientSecret();
  }, [loadClientSecret, showCardForm]);

  if (!showCardForm) {
    return (
      <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="text-sm text-white/75">
          Prefer card payment? Continue to secure Stripe checkout.
        </div>
        <Button type="button" variant="outline" onClick={() => setShowCardForm(true)}>
          Pay with Card
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/70">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing secure payment form...
      </div>
    );
  }

  if (error || !clientSecret) {
    return (
      <div className="space-y-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        <div>{error ?? 'Unable to load payment form.'}</div>
        <Button type="button" variant="outline" onClick={() => void loadClientSecret()}>
          Retry
        </Button>
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
