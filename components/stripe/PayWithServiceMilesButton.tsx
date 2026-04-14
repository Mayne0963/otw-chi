'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

type PayWithServiceMilesButtonProps = {
  deliveryRequestId: string;
  requiredMiles: number;
};

export default function PayWithServiceMilesButton({
  deliveryRequestId,
}: PayWithServiceMilesButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const payWithMiles = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/requests/${deliveryRequestId}/pay-with-miles`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        requiredMiles?: number;
        availableMiles?: number;
        settledType?: 'DELIVERY_FEE' | 'OVERAGE';
        settledWithMiles?: number;
        alreadyPaid?: boolean;
      } | null;

      if (!response.ok) {
        toast({
          title: 'Unable to use membership balance',
          description:
            payload?.error ||
            'Please try again or use card payment.',
          variant: 'destructive',
        });
        return;
      }

      if (payload?.alreadyPaid) {
        toast({
          title: 'Already settled',
          description: 'This request is already paid.',
        });
        router.push(`/requests/${deliveryRequestId}`);
        router.refresh();
        return;
      }

      const settledLabel =
        payload?.settledType === 'DELIVERY_FEE' ? 'delivery fee' : 'overage balance';

      toast({
        title: 'Paid with membership balance',
        description: `Your ${settledLabel} is settled.`,
      });
      router.push(`/requests/${deliveryRequestId}`);
      router.refresh();
    } catch {
      toast({
        title: 'Unable to use membership balance',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="gold"
      onClick={() => void payWithMiles()}
      disabled={isSubmitting}
      className="w-full"
    >
      {isSubmitting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        'Use membership balance'
      )}
    </Button>
  );
}
