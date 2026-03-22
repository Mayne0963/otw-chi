'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [pickupPassUrl, setPickupPassUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const revokeBlobUrl = () => {
    if (!blobUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
  };

  useEffect(() => {
    return () => {
      revokeBlobUrl();
    };
  }, []);

  const toPreviewUrl = async (rawPickupPassUrl: string): Promise<string> => {
    if (!rawPickupPassUrl.startsWith('data:')) {
      return rawPickupPassUrl;
    }

    const response = await fetch(rawPickupPassUrl);
    if (!response.ok) {
      throw new Error('Pickup pass is unavailable for this request.');
    }

    const blob = await response.blob();
    revokeBlobUrl();
    const objectUrl = URL.createObjectURL(blob);
    blobUrlRef.current = objectUrl;
    return objectUrl;
  };

  const closeModal = () => {
    setModalOpen(false);
    setErrorMessage(null);
    setPickupPassUrl(null);
    revokeBlobUrl();
  };

  const handleOpen = async () => {
    setModalOpen(true);
    setIsOpening(true);
    setErrorMessage(null);
    setPickupPassUrl(null);
    revokeBlobUrl();

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

      const previewUrl = await toPreviewUrl(payload.pickupPassUrl);
      setPickupPassUrl(previewUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to open pickup pass right now.';
      setErrorMessage(message);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Dialog.Root
      open={modalOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeModal();
          return;
        }
        setModalOpen(true);
      }}
    >
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

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:pointer-events-none" />
        <Dialog.Content className="otw-inverse-surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0c0f14]/95 p-4 text-white shadow-2xl backdrop-blur-xl focus:outline-none sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-semibold text-white">Pickup Pass</Dialog.Title>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-md border border-white/20 px-2 py-1 text-xs font-medium text-white/85 transition hover:border-white/40 hover:text-white"
            >
              Close
            </button>
          </div>
          <Dialog.Description className="mt-1 text-xs text-white/65">
            Keep this open while confirming pickup.
          </Dialog.Description>

          <div className="mt-4 min-h-[200px]">
            {isOpening ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-white/10 bg-black/25 text-sm text-white/70">
                Loading pickup pass...
              </div>
            ) : null}

            {!isOpening && errorMessage ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            {!isOpening && !errorMessage && pickupPassUrl ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                <img
                  src={pickupPassUrl}
                  alt="Pickup pass"
                  className="max-h-[70vh] w-full rounded-lg object-contain"
                />
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
