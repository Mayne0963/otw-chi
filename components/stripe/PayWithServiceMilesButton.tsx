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
  requiredMiles,
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
        const missingMiles =
          typeof payload?.requiredMiles === 'number' && typeof payload?.availableMiles === 'number'
            ? Math.max(0, payload.requiredMiles - payload.availableMiles)
            : null;

        toast({
          title: 'Unable to pay with Service Miles',
          description:
            payload?.error ||
            (missingMiles !== null
              ? `You need ${missingMiles} more Service Miles for this request.`
              : 'Please try again.'),
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

      const settledMiles =
        typeof payload?.settledWithMiles === 'number' ? payload.settledWithMiles : requiredMiles;
      const settledLabel =
        payload?.settledType === 'DELIVERY_FEE' ? 'delivery fee' : 'overage balance';

      toast({
        title: 'Paid with Service Miles',
        description: `Used ${settledMiles} Service Miles to settle your ${settledLabel}.`,
      });
      router.push(`/requests/${deliveryRequestId}`);
      router.refresh();
    } catch {
      toast({
        title: 'Unable to pay with Service Miles',
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
        `Pay with ${requiredMiles} Service Miles`
      )}
    </Button>
  );
}
