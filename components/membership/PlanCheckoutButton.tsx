'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function PlanCheckoutButton({
  plan,
  planId,
  priceId,
  children,
  className,
  disabled,
}: {
  plan?: 'basic' | 'plus' | 'executive';
  planId?: string;
  priceId?: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
      if (data?.url) {
        router.push(data.url);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={startCheckout} className={className} disabled={disabled || loading}>
      {children ?? (loading ? 'Processing...' : 'Choose Plan')}
    </Button>
  );
}
