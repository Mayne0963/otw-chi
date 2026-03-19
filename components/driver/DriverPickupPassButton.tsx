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

  const toOpenableUrl = async (pickupPassUrl: string): Promise<string> => {
    if (!pickupPassUrl.startsWith('data:')) {
      return pickupPassUrl;
    }

    const response = await fetch(pickupPassUrl);
    if (!response.ok) {
      throw new Error('Pickup pass is unavailable for this request.');
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  const handleOpen = async () => {
    setIsOpening(true);
    const popup = window.open('', '_blank');
    if (popup) {
      popup.opener = null;
      popup.document.title = 'Opening pickup pass...';
    }

    try {
      const response = await fetch(`/api/requests/${requestId}/pickup-pass`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => null)) as PickupPassPayload | null;
      if (!response.ok || !payload?.pickupPassUrl) {
        if (response.status === 410) {
          throw new Error('Pickup pass has expired.');
        }
        if (response.status === 404) {
          throw new Error('No pickup pass was uploaded for this request.');
        }
        if (response.status === 403) {
          throw new Error('Pickup pass is locked until this request is assigned to you.');
        }
        throw new Error(payload?.error ?? 'Pickup pass is unavailable for this request.');
      }

      const openableUrl = await toOpenableUrl(payload.pickupPassUrl);

      if (popup && !popup.closed) {
        popup.location.replace(openableUrl);
      } else {
        const opened = window.open(openableUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
          throw new Error('Please allow popups to view the pickup pass.');
        }
      }

      if (openableUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(openableUrl), 60_000);
      }
    } catch (error) {
      if (popup && !popup.closed) {
        popup.close();
      }
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
