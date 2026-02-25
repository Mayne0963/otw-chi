'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

type PickupVerificationPanelProps = {
  requestId: string;
  canEdit: boolean;
  pickupPassFeatureEnabled: boolean;
  initialOrderReference: string | null;
  initialPickupInstructions: string | null;
  initialDropoffInstructions: string | null;
  initialPickupCodeType: string | null;
  initialPickupCodeText: string | null;
  initialPickupPassUploadedAt: string | null;
  initialPickupPassExpiresAt: string | null;
  initialPickupPassExpired: boolean;
  initialHasPickupPass: boolean;
};

const PICKUP_CODE_TYPES = [
  { value: '', label: 'None' },
  { value: 'QR', label: 'QR' },
  { value: 'BARCODE', label: 'Barcode' },
  { value: 'PIN', label: 'PIN' },
  { value: 'CONFIRMATION', label: 'Confirmation' },
];

export default function PickupVerificationPanel({
  requestId,
  canEdit,
  pickupPassFeatureEnabled,
  initialOrderReference,
  initialPickupInstructions,
  initialDropoffInstructions,
  initialPickupCodeType,
  initialPickupCodeText,
  initialPickupPassUploadedAt,
  initialPickupPassExpiresAt,
  initialPickupPassExpired,
  initialHasPickupPass,
}: PickupVerificationPanelProps) {
  const [orderReference, setOrderReference] = useState(initialOrderReference ?? '');
  const [pickupInstructions, setPickupInstructions] = useState(initialPickupInstructions ?? '');
  const [dropoffInstructions, setDropoffInstructions] = useState(initialDropoffInstructions ?? '');
  const [pickupCodeType, setPickupCodeType] = useState(initialPickupCodeType ?? '');
  const [pickupCodeText, setPickupCodeText] = useState(initialPickupCodeText ?? '');

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [hasPickupPass, setHasPickupPass] = useState(initialHasPickupPass);
  const [pickupPassExpired, setPickupPassExpired] = useState(initialPickupPassExpired);
  const [pickupPassUploadedAt, setPickupPassUploadedAt] = useState<string | null>(initialPickupPassUploadedAt);
  const [pickupPassExpiresAt, setPickupPassExpiresAt] = useState<string | null>(initialPickupPassExpiresAt);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingPassLink, setIsLoadingPassLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasPassAndNotExpired = hasPickupPass && !pickupPassExpired;

  const pickupPassStatusLabel = useMemo(() => {
    if (!hasPickupPass) {
      return 'No pickup pass uploaded yet.';
    }

    if (pickupPassExpired) {
      return 'Pickup pass expired.';
    }

    if (pickupPassExpiresAt) {
      return `Pickup pass active until ${formatDate(pickupPassExpiresAt)}`;
    }

    return 'Pickup pass uploaded.';
  }, [hasPickupPass, pickupPassExpired, pickupPassExpiresAt]);

  const saveDetails = async () => {
    if (!canEdit) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderReference,
          pickupInstructions,
          dropoffInstructions,
          ...(pickupPassFeatureEnabled
            ? {
                pickupCodeType,
                pickupCodeText,
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Unable to save request details');
      }

      setSuccess('Pickup details saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save request details');
    } finally {
      setIsSaving(false);
    }
  };

  const uploadPickupPass = async () => {
    if (!canEdit || !pickupPassFeatureEnabled || !uploadFile) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.set('deliveryRequestId', requestId);
      formData.set('file', uploadFile);

      const response = await fetch('/api/upload/pickup-pass', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Unable to upload pickup pass');
      }

      const payload = (await response.json()) as {
        pickupPassUploadedAt?: string;
        pickupPassExpiresAt?: string;
      };

      setUploadFile(null);
      setHasPickupPass(true);
      setPickupPassExpired(false);
      setPickupPassUploadedAt(payload.pickupPassUploadedAt ?? null);
      setPickupPassExpiresAt(payload.pickupPassExpiresAt ?? null);
      setSuccess('Pickup pass uploaded.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload pickup pass');
    } finally {
      setIsUploading(false);
    }
  };

  const openPickupPass = async () => {
    setIsLoadingPassLink(true);
    setError(null);

    try {
      const response = await fetch(`/api/requests/${requestId}/pickup-pass`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Unable to open pickup pass');
      }

      const payload = (await response.json()) as { pickupPassUrl?: string; pickupPassExpiresAt?: string | null };
      if (!payload.pickupPassUrl) {
        throw new Error('Pickup pass URL unavailable');
      }

      if (payload.pickupPassExpiresAt) {
        setPickupPassExpiresAt(payload.pickupPassExpiresAt);
      }

      window.open(payload.pickupPassUrl, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      if (openError instanceof Error && /expired/i.test(openError.message)) {
        setPickupPassExpired(true);
      }
      setError(openError instanceof Error ? openError.message : 'Unable to open pickup pass');
    } finally {
      setIsLoadingPassLink(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Pickup Verification</h3>
        <p className="mt-1 text-xs text-white/60">
          OTW does not verify merchant authenticity. This info is shown to your driver to complete pickup.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-white/70">Order Reference</label>
          <Input
            value={orderReference}
            onChange={(event) => setOrderReference(event.target.value)}
            disabled={!canEdit || isSaving}
            placeholder="Order #12345"
            maxLength={120}
            className="bg-black/30 text-white"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-white/70">Pickup Instructions</label>
          <Textarea
            value={pickupInstructions}
            onChange={(event) => setPickupInstructions(event.target.value)}
            disabled={!canEdit || isSaving}
            placeholder="Counter name, aisle, who to ask for..."
            className="min-h-[84px] bg-black/30 text-white"
            maxLength={2000}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-white/70">Dropoff Instructions</label>
          <Textarea
            value={dropoffInstructions}
            onChange={(event) => setDropoffInstructions(event.target.value)}
            disabled={!canEdit || isSaving}
            placeholder="Door, gate, floor, concierge details..."
            className="min-h-[84px] bg-black/30 text-white"
            maxLength={2000}
          />
        </div>

        {pickupPassFeatureEnabled && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/70">Pickup Code Type</label>
              <Select
                value={pickupCodeType}
                onChange={(event) => setPickupCodeType(event.target.value)}
                disabled={!canEdit || isSaving}
                className="bg-black/30 text-white"
              >
                {PICKUP_CODE_TYPES.map((option) => (
                  <option key={option.value || 'none'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/70">Pickup Code / PIN</label>
              <Input
                value={pickupCodeText}
                onChange={(event) => setPickupCodeText(event.target.value)}
                disabled={!canEdit || isSaving}
                placeholder="Enter code text"
                className="bg-black/30 text-white"
                maxLength={255}
              />
            </div>
          </>
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button type="button" variant="gold" size="sm" onClick={saveDetails} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Pickup Details'}
          </Button>
        </div>
      )}

      {pickupPassFeatureEnabled && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div>
            <div className="text-xs font-medium text-white/70">Pickup Pass Image (Optional)</div>
            <p className="mt-1 text-xs text-white/60">
              Upload a screenshot/photo of QR or barcode for the assigned driver. Auto-expiration: 14 days.
            </p>
            <p className="mt-1 text-xs text-white/50">{pickupPassStatusLabel}</p>
            {pickupPassUploadedAt ? (
              <p className="text-xs text-white/45">Uploaded {formatDate(pickupPassUploadedAt)}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  disabled={isUploading}
                  className="max-w-sm bg-black/30 text-white file:mr-3 file:rounded file:border file:border-white/20 file:bg-white/10 file:px-2 file:py-1 file:text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={uploadPickupPass}
                  disabled={isUploading || !uploadFile}
                >
                  {isUploading ? 'Uploading...' : 'Upload Pass'}
                </Button>
              </>
            )}

            {hasPassAndNotExpired && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openPickupPass}
                disabled={isLoadingPassLink}
              >
                {isLoadingPassLink ? 'Opening...' : 'View Pickup Pass'}
              </Button>
            )}
          </div>
        </div>
      )}

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {success ? <p className="text-xs text-green-300">{success}</p> : null}
    </div>
  );
}
