'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import OtwButton from '@/components/ui/otw/OtwButton';
import { useToast } from '@/components/ui/use-toast';

export default function PlanCheckoutButton({
  plan,
  planId,
  priceId,
  children,
  className,
  disabled,
}: {
  plan?: 'basic' | 'plus' | 'pro' | 'elite' | 'black';
  planId?: string;
  priceId?: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const startCheckout = async () => {
    if (disabled || loading) return;
    if (!planId && !priceId && !plan) return;
    setLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (planId) payload.planId = planId;
      if (priceId) payload.priceId = priceId;
      if (plan) payload.plan = plan;

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        const returnUrl = encodeURIComponent('/pricing');
        router.push(`/sign-in?redirect_url=${returnUrl}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Checkout failed',
          description: data?.error || 'Unable to start checkout. Please try again.',
          variant: 'destructive',
        });
        return;
      }
      if (data?.url) {
        router.push(data.url);
        return;
      }
      toast({
        title: 'Checkout failed',
        description: 'Stripe did not return a checkout URL.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <OtwButton onClick={startCheckout} className={className} disabled={disabled || loading} variant="gold">
      {children ?? (loading ? 'Processing...' : 'Choose Plan')}
    </OtwButton>
  );
}
