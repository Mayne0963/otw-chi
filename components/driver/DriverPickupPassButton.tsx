'use client';

import { useState } from 'react';
import OtwButton from '@/components/ui/otw/OtwButton';

type PickupPassPayload = {
  pickupPassUrl?: string;
  error?: string;
};

type DriverPickupPassButtonProps = {
  requestId: string;
  className?: string;
  label?: string;
};

export default function DriverPickupPassButton({
  requestId,
  className,
  label = 'View Pickup Pass',
}: DriverPickupPassButtonProps) {
  const [isOpening, setIsOpening] = useState(false);

  const handleOpen = async () => {
    setIsOpening(true);

    try {
      const response = await fetch(`/api/requests/${requestId}/pickup-pass`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => null)) as PickupPassPayload | null;
      if (!response.ok || !payload?.pickupPassUrl) {
        throw new Error(payload?.error ?? 'Pickup pass is unavailable for this request.');
      }

      const opened = window.open(payload.pickupPassUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.href = payload.pickupPassUrl;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to open pickup pass right now.';
      window.alert(message);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <OtwButton
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={handleOpen}
      disabled={isOpening}
    >
      {isOpening ? 'Opening...' : label}
    </OtwButton>
  );
}
