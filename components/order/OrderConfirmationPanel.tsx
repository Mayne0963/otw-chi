'use client';

import { type ChangeEvent, useMemo, useState } from 'react';
import OtwButton from '@/components/ui/otw/OtwButton';

type OrderItem = {
  itemKey?: string;
  name: string;
  quantity?: number;
  qty?: number;
  price?: number;
  unitPrice?: number;
  notes?: string;
};

type ConfirmationSummary = {
  customerConfirmed: boolean;
  confirmedAt: string | null;
  disputeStatus: string;
  disputedItemsCount: number;
};

type Props = {
  deliveryRequestId: string;
  items: OrderItem[];
  confirmation: ConfirmationSummary | null;
};

type DisputeReason = 'MISSING' | 'WRONG_ITEM' | 'BAD_QUALITY' | 'DAMAGED';

type LocalDisputeSelection = {
  selected: boolean;
  qtyDisputed: number;
  reason: DisputeReason;
  details: string;
};

type UploadedEvidence = {
  ref: string;
  previewUrl: string | null;
  label: string;
};

const REASON_OPTIONS: DisputeReason[] = ['MISSING', 'WRONG_ITEM', 'BAD_QUALITY', 'DAMAGED'];

function buildItemKey(item: OrderItem, index: number): string {
  if (item.itemKey && item.itemKey.trim()) return item.itemKey.trim();
  const base = item.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-');
  return `${base || 'item'}-${index + 1}`;
}

function formatDate(value: string | null): string {
  if (!value) return 'Not confirmed yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  // Use a deterministic UTC format to avoid server/client hydration mismatches.
  return parsed.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

export default function OrderConfirmationPanel({ deliveryRequestId, items, confirmation }: Props) {
  const normalizedItems = useMemo(
    () =>
      items.map((item, index) => ({
        itemKey: buildItemKey(item, index),
        name: item.name,
        qty: Math.max(1, Math.round(item.qty ?? item.quantity ?? 1)),
      })),
    [items]
  );

  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [evidenceInput, setEvidenceInput] = useState('');
  const [disputeNotes, setDisputeNotes] = useState('');
  const [selectionByKey, setSelectionByKey] = useState<Record<string, LocalDisputeSelection>>({});
  const [pendingEvidenceFiles, setPendingEvidenceFiles] = useState<File[]>([]);
  const [uploadedEvidence, setUploadedEvidence] = useState<UploadedEvidence[]>([]);
  const [evidenceInputKey, setEvidenceInputKey] = useState(0);

  const selectedDisputedItems = normalizedItems
    .map((item) => ({ item, selection: selectionByKey[item.itemKey] }))
    .filter((entry) => entry.selection?.selected)
    .map((entry) => ({
      itemIdOrName: entry.item.itemKey,
      qtyDisputed: entry.selection?.qtyDisputed ?? 1,
      reason: entry.selection?.reason ?? 'BAD_QUALITY',
      details: entry.selection?.details?.trim() || undefined,
      maxQty: entry.item.qty,
    }));

  const canSubmitDispute = disputeNotes.trim().length > 0 && !isUploadingEvidence;

  const handleConfirm = async () => {
    setIsConfirming(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/delivery-request/${deliveryRequestId}/confirm-items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerConfirmed: true,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Unable to confirm items');
      }

      setStatusMessage('Items confirmed successfully.');
      setAgreed(false);
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to confirm items');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleEvidenceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setPendingEvidenceFiles(files);
  };

  const handleUploadEvidence = async () => {
    if (pendingEvidenceFiles.length === 0) {
      setErrorMessage('Choose at least one image or video to upload.');
      return;
    }

    setIsUploadingEvidence(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const uploadedBatch: UploadedEvidence[] = [];

      for (const file of pendingEvidenceFiles) {
        const formData = new FormData();
        formData.set('deliveryRequestId', deliveryRequestId);
        formData.set('file', file);

        const response = await fetch('/api/upload/dispute-evidence', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const data = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; evidenceRef?: string; evidenceUrl?: string | null; fileName?: string }
          | null;

        if (!response.ok || !data?.ok || !data.evidenceRef) {
          throw new Error(data?.error || `Failed to upload ${file.name}`);
        }

        uploadedBatch.push({
          ref: data.evidenceRef,
          previewUrl: data.evidenceUrl ?? null,
          label: data.fileName?.trim() || file.name,
        });
      }

      setUploadedEvidence((prev) => {
        const byRef = new Map(prev.map((entry) => [entry.ref, entry]));
        uploadedBatch.forEach((entry) => byRef.set(entry.ref, entry));
        return Array.from(byRef.values());
      });
      setPendingEvidenceFiles([]);
      setEvidenceInputKey((prev) => prev + 1);
      setStatusMessage(
        uploadedBatch.length === 1
          ? 'Evidence uploaded.'
          : `${uploadedBatch.length} evidence files uploaded.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to upload evidence');
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  const handleDisputeSubmit = async () => {
    if (!disputeNotes.trim()) {
      setErrorMessage('Add dispute notes before submitting.');
      return;
    }

    if (isUploadingEvidence) {
      setErrorMessage('Please wait for evidence uploads to finish.');
      return;
    }

    setIsSubmittingDispute(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const manualEvidenceUrls = evidenceInput
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const evidenceUrls = Array.from(
      new Set([...uploadedEvidence.map((entry) => entry.ref), ...manualEvidenceUrls])
    );

    try {
      const response = await fetch(`/api/delivery-request/${deliveryRequestId}/dispute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          disputedItems: selectedDisputedItems.map((item) => ({
            itemIdOrName: item.itemIdOrName,
            qtyDisputed: Math.max(1, Math.min(item.qtyDisputed, item.maxQty)),
            reason: item.reason,
            details: item.details,
          })),
          disputeNotes: disputeNotes.trim(),
          evidenceUrls,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; disputeStatus?: string }
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Unable to submit dispute');
      }

      setStatusMessage(`Dispute submitted. Current status: ${data.disputeStatus ?? 'OPEN'}.`);
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit dispute');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const summary = confirmation ?? {
    customerConfirmed: false,
    confirmedAt: null,
    disputeStatus: 'NONE',
    disputedItemsCount: 0,
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Item Confirmation</div>
          <div className="text-xs text-white/60">Confirm purchased items before filing reimbursement disputes.</div>
        </div>
        <span className="text-xs text-white/60">
          {summary.customerConfirmed ? `Confirmed: ${formatDate(summary.confirmedAt)}` : 'Not confirmed'}
        </span>
      </div>

      <div className="space-y-2">
        {normalizedItems.length > 0 ? (
          normalizedItems.map((item) => (
            <div key={item.itemKey} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <span className="text-white/90">{item.name}</span>
              <span className="text-white/60">x{item.qty}</span>
            </div>
          ))
        ) : (
          <div className="text-sm text-white/60">No items available yet.</div>
        )}
      </div>

      {normalizedItems.length > 0 && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/40"
            />
            I confirm these are the items purchased/received.
          </label>
          <OtwButton
            variant="outline"
            className="w-full"
            disabled={!agreed || isConfirming}
            onClick={handleConfirm}
            data-testid="confirm-items-button"
          >
            {isConfirming ? 'Confirming...' : 'Confirm Items'}
          </OtwButton>
        </div>
      )}

      <div className="border-t border-white/10 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Report a Problem</div>
          <span className="text-xs text-white/60">
            Current dispute status: {summary.disputeStatus} ({summary.disputedItemsCount})
          </span>
        </div>
        <OtwButton
          variant="ghost"
          className="w-full"
          onClick={() => setShowDisputeForm((value) => !value)}
        >
          {showDisputeForm ? 'Hide Dispute Form' : 'Report a Problem'}
        </OtwButton>
      </div>

      {showDisputeForm && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3" data-testid="dispute-modal">
          <div className="text-xs uppercase tracking-wide text-white/60">
            Select specific item(s) to dispute (optional)
          </div>
          {normalizedItems.map((item) => {
            const selection = selectionByKey[item.itemKey] ?? {
              selected: false,
              qtyDisputed: 1,
              reason: 'MISSING' as DisputeReason,
              details: '',
            };

            return (
              <div key={item.itemKey} className="space-y-2 rounded-lg border border-white/10 p-2">
                <label className="flex items-center gap-2 text-sm text-white/90">
                  <input
                    type="checkbox"
                    checked={selection.selected}
                    onChange={(event) =>
                      setSelectionByKey((prev) => ({
                        ...prev,
                        [item.itemKey]: {
                          ...selection,
                          selected: event.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded border-white/20 bg-black/40"
                  />
                  {item.name} (max {item.qty})
                </label>

                {selection.selected && (
                  <div className="grid gap-2 md:grid-cols-3">
                    <input
                      type="number"
                      min={1}
                      max={item.qty}
                      value={selection.qtyDisputed}
                      onChange={(event) =>
                        setSelectionByKey((prev) => ({
                          ...prev,
                          [item.itemKey]: {
                            ...selection,
                            qtyDisputed: Math.max(1, Math.min(item.qty, Number(event.target.value) || 1)),
                          },
                        }))
                      }
                      className="rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-white"
                    />
                    <select
                      value={selection.reason}
                      onChange={(event) =>
                        setSelectionByKey((prev) => ({
                          ...prev,
                          [item.itemKey]: {
                            ...selection,
                            reason: event.target.value as DisputeReason,
                          },
                        }))
                      }
                      className="rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-white"
                    >
                      {REASON_OPTIONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={selection.details}
                      placeholder="Details (optional)"
                      onChange={(event) =>
                        setSelectionByKey((prev) => ({
                          ...prev,
                          [item.itemKey]: {
                            ...selection,
                            details: event.target.value,
                          },
                        }))
                      }
                      className="rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-white"
                    />
                  </div>
                )}
              </div>
            );
          })}

          <textarea
            value={disputeNotes}
            onChange={(event) => setDisputeNotes(event.target.value)}
            placeholder="Overall dispute notes (required)"
            className="min-h-[80px] w-full rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-white"
          />

          <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-wide text-white/60">Evidence Upload (Optional)</div>
            <input
              key={evidenceInputKey}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleEvidenceFileChange}
              className="w-full text-sm text-white/80 file:mr-3 file:rounded-md file:border-0 file:bg-white/15 file:px-3 file:py-1 file:text-sm file:text-white hover:file:bg-white/20"
            />
            <OtwButton
              variant="outline"
              className="w-full"
              disabled={pendingEvidenceFiles.length === 0 || isUploadingEvidence}
              onClick={handleUploadEvidence}
            >
              {isUploadingEvidence ? 'Uploading Evidence...' : 'Upload Evidence'}
            </OtwButton>
            {uploadedEvidence.length > 0 && (
              <div className="space-y-1 text-xs text-white/70">
                {uploadedEvidence.map((entry) => (
                  <div key={entry.ref} className="truncate">
                    {entry.previewUrl ? (
                      <a href={entry.previewUrl} target="_blank" rel="noreferrer" className="text-otwGold underline">
                        {entry.label}
                      </a>
                    ) : (
                      <span>{entry.label}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <textarea
            value={evidenceInput}
            onChange={(event) => setEvidenceInput(event.target.value)}
            placeholder="Additional evidence URLs (optional, comma or newline separated)"
            className="min-h-[80px] w-full rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-white"
          />

          <OtwButton
            variant="red"
            className="w-full"
            disabled={!canSubmitDispute || isSubmittingDispute || isUploadingEvidence}
            onClick={handleDisputeSubmit}
          >
            {isSubmittingDispute ? 'Submitting Dispute...' : 'Submit Dispute'}
          </OtwButton>
        </div>
      )}

      {statusMessage && <div className="text-sm text-green-400">{statusMessage}</div>}
      {errorMessage && <div className="text-sm text-red-400">{errorMessage}</div>}
    </div>
  );
}
