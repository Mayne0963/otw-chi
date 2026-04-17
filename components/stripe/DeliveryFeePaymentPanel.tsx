'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

type DeliveryCheckoutResponse = {
  alreadyPaid?: boolean;
  free?: boolean;
  url?: string;
  couponCode?: string;
  discountCents?: number;
  error?: string;
  message?: string;
  details?: unknown;
};

type DeliveryFeePaymentPanelProps = {
  deliveryRequestId: string;
  amountCents: number;
  couponEntryEnabled?: boolean;
};

export default function DeliveryFeePaymentPanel({
  deliveryRequestId,
  amountCents,
  couponEntryEnabled = false,
}: DeliveryFeePaymentPanelProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ status: number | null; message: string } | null>(null);

  const startCheckout = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/delivery-checkout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveryRequestId,
          couponCode: couponEntryEnabled ? couponCode.trim() || undefined : undefined,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as DeliveryCheckoutResponse;

      if (!res.ok) {
        const baseMessage = payload.error || payload.message || 'Unable to start Stripe Checkout';
        const details = typeof payload.details === 'string' && payload.details.trim().length > 0
          ? payload.details.trim()
          : null;
        const message = details ? `${baseMessage} (${details})` : baseMessage;
        const loadError = { status: res.status, message };
        setError(loadError);
        toast({
          title: 'Checkout failed',
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

      if (!payload.url) {
        throw new Error('Stripe did not return a checkout URL');
      }

      if (payload.free) {
        toast({
          title: 'Coupon applied',
          description: 'No card payment is required for this delivery fee.',
        });
      }

      window.location.href = payload.url;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to start Stripe Checkout';
      setError({ status: null, message });
      toast({
        title: 'Checkout failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = error?.status !== null && error?.status !== undefined ? String(error.status) : 'Unknown';

  return (
    <div className="space-y-4">
      {couponEntryEnabled ? (
        <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-4">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            Coupon Code
          </label>
          <Input
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
            placeholder="Enter coupon code"
            className="bg-black/30 text-white"
            autoComplete="off"
          />
          <p className="text-xs text-white/55">
            Enter an active coupon before continuing to Stripe Checkout.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="space-y-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <div className="space-y-1">
            <div className="font-semibold">Error {statusLabel}</div>
            <div>{error.message}</div>
          </div>
        </div>
      ) : null}

      <Button type="button" className="w-full" onClick={() => void startCheckout()} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening Stripe Checkout...
          </>
        ) : (
          `Pay $${(amountCents / 100).toFixed(2)} with Stripe`
        )}
      </Button>

      <Button type="button" variant="ghost" className="w-full" onClick={() => router.push(`/request/${deliveryRequestId}`)}>
        Back to Request
      </Button>
    </div>
  );
}
