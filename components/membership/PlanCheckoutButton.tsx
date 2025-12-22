'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function PlanCheckoutButton({ plan, children, className, disabled }: { plan: 'basic' | 'plus' | 'executive'; children?: React.ReactNode; className?: string; disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        const returnUrl = encodeURIComponent('/pricing');
        router.push(`/sign-in?redirect_url=${returnUrl}`);
        return;
      }
      const data = await res.json();
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

