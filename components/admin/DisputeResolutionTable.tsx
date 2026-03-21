'use client';

import { useMemo, useState } from 'react';
import OtwButton from '@/components/ui/otw/OtwButton';

type DisputeRow = {
  id: string;
  deliveryRequestId: string;
  createdAt: string;
  customerConfirmed: boolean;
  confirmedAt: string | null;
  disputeStatus: string;
  disputeNotes: string | null;
  evidenceUrls: string[];
  requestLocked: boolean;
  requestStatus: string;
  disputedItems: Array<{ itemKey?: string; name?: string; qtyDisputed?: number; reason?: string; details?: string }>;
  resolutionNotes: string | null;
  refundAmount: string | null;
};

type Props = {
  disputes: DisputeRow[];
};

type Resolution = 'APPROVED' | 'DENIED' | 'NEEDS_INFO';

function statusTone(status: string): string {
  if (status === 'RESOLVED_APPROVED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
  if (status === 'RESOLVED_DENIED') return 'bg-rose-500/15 text-rose-300 border-rose-400/30';
  if (status === 'NEEDS_INFO') return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
  return 'bg-blue-500/15 text-blue-300 border-blue-400/30';
}

function formatCreatedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Indiana/Indianapolis',
  }).format(parsed);
}

function extractEvidenceLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const raw = parsed.pathname.split('/').pop();
    if (!raw) return url;
    const decoded = decodeURIComponent(raw);
    return decoded.length > 48 ? `${decoded.slice(0, 45)}...` : decoded;
  } catch {
    return url.length > 48 ? `${url.slice(0, 45)}...` : url;
  }
}

function isPositiveAmount(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0;
}

export default function DisputeResolutionTable({ disputes }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [refundById, setRefundById] = useState<Record<string, string>>({});
  const [statusById, setStatusById] = useState<Record<string, string>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const ordered = useMemo(
    () =>
      [...disputes].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [disputes]
  );

  const query = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return ordered;
    return ordered.filter((dispute) => {
      const haystack = [
        dispute.id,
        dispute.deliveryRequestId,
        dispute.disputeNotes ?? '',
        dispute.disputeStatus,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [ordered, query]);

  const resolveDispute = async (dispute: DisputeRow, resolution: Resolution) => {
    const notes = (notesById[dispute.id] ?? dispute.resolutionNotes ?? '').trim();
    const refundAmount = (refundById[dispute.id] ?? dispute.refundAmount ?? '').trim();

    if (resolution === 'NEEDS_INFO' && !notes) {
      setErrorById((prev) => ({
        ...prev,
        [dispute.id]: 'Add notes describing what information the customer needs to provide.',
      }));
      return;
    }

    if (resolution === 'APPROVED' && !isPositiveAmount(refundAmount)) {
      setErrorById((prev) => ({
        ...prev,
        [dispute.id]: 'Enter a valid refund amount before approving.',
      }));
      return;
    }

    if (resolution !== 'NEEDS_INFO') {
      const confirmed = window.confirm(
        resolution === 'APPROVED'
          ? `Approve this dispute refund for $${Number(refundAmount).toFixed(2)}?`
          : 'Deny this dispute?'
      );
      if (!confirmed) return;
    }

    setPendingId(dispute.id);
    setErrorById((prev) => ({ ...prev, [dispute.id]: '' }));
    setStatusById((prev) => ({ ...prev, [dispute.id]: '' }));

    try {
      const payload: { resolution: Resolution; notes?: string; refundAmount?: string } = {
        resolution,
      };
      if (notes) payload.notes = notes;
      if (resolution === 'APPROVED') payload.refundAmount = refundAmount;

      const response = await fetch(`/api/admin/disputes/${dispute.id}/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; disputeStatus?: string; error?: string }
        | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to resolve dispute');
      }

      setStatusById((prev) => ({
        ...prev,
        [dispute.id]: `Updated: ${data.disputeStatus ?? resolution}`,
      }));
      window.location.reload();
    } catch (error) {
      setErrorById((prev) => ({
        ...prev,
        [dispute.id]: error instanceof Error ? error.message : 'Failed to resolve dispute',
      }));
    } finally {
      setPendingId(null);
    }
  };

  if (ordered.length === 0) {
    return <div className="text-sm text-white/60">No disputes found.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by request ID, confirmation ID, notes, or status"
            className="w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-sm text-white md:max-w-xl"
          />
          <div className="text-xs text-white/60">
            Showing {filtered.length} of {ordered.length}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No disputes match your search.
        </div>
      ) : null}

      {filtered.map((dispute) => {
        const notesValue = notesById[dispute.id] ?? dispute.resolutionNotes ?? '';
        const refundValue = refundById[dispute.id] ?? dispute.refundAmount ?? '';
        const isPending = pendingId === dispute.id;

        return (
          <div key={dispute.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-white">Confirmation {dispute.id}</div>
                <div className="mt-1 text-xs text-white/60">
                  Request {dispute.deliveryRequestId} • Created {formatCreatedAt(dispute.createdAt)}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(dispute.disputeStatus)}`}>
                    {dispute.disputeStatus}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${dispute.requestLocked ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-amber-400/30 bg-amber-500/15 text-amber-300'}`}>
                    {dispute.requestLocked ? 'LOCKED' : 'UNLOCKED'}
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-white/70">
                    Request {dispute.requestStatus}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-xs text-white/60">
                  Confirmed: {dispute.customerConfirmed ? (dispute.confirmedAt ?? 'yes') : 'no'}
                </div>
                <OtwButton as="a" href={`/admin/requests/${dispute.deliveryRequestId}`} variant="outline" size="sm">
                  Open Request
                </OtwButton>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="text-xs uppercase tracking-wide text-white/60">Disputed Items</div>
                {dispute.disputedItems.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-white/80">
                    {dispute.disputedItems.map((item, index) => (
                      <li key={`${dispute.id}-${index}`}>
                        {item.name || item.itemKey || 'Item'} • qty {item.qtyDisputed ?? 1} • {item.reason || 'UNKNOWN'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 text-sm text-white/60">
                    General dispute (no specific item selected).
                  </div>
                )}
                {dispute.disputeNotes && (
                  <div className="mt-2 text-xs text-white/70">Notes: {dispute.disputeNotes}</div>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="text-xs uppercase tracking-wide text-white/60">Evidence</div>
                {dispute.evidenceUrls.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs">
                    {dispute.evidenceUrls.map((url, index) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-otwGold underline"
                      >
                        Evidence {index + 1}: {extractEvidenceLabel(url)}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-white/60">No evidence attached.</div>
                )}
                {!dispute.requestLocked ? (
                  <div className="mt-2 text-xs text-amber-300">
                    Request is unlocked. Verify receipt/confirmation details from request page before approving.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <textarea
                value={notesValue}
                onChange={(event) =>
                  setNotesById((prev) => ({ ...prev, [dispute.id]: event.target.value }))
                }
                placeholder="Resolution notes (required for Request More Info)"
                className="min-h-[70px] rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-white"
              />
              <input
                type="text"
                value={refundValue}
                onChange={(event) =>
                  setRefundById((prev) => ({ ...prev, [dispute.id]: event.target.value }))
                }
                placeholder="Refund amount (required for approvals)"
                className="rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-white"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <OtwButton
                variant="gold"
                disabled={isPending || !isPositiveAmount(refundValue)}
                onClick={() => resolveDispute(dispute, 'APPROVED')}
              >
                Approve Refund
              </OtwButton>
              <OtwButton
                variant="red"
                disabled={isPending}
                onClick={() => resolveDispute(dispute, 'DENIED')}
              >
                Deny
              </OtwButton>
              <OtwButton
                variant="outline"
                disabled={isPending || !notesValue.trim()}
                onClick={() => resolveDispute(dispute, 'NEEDS_INFO')}
              >
                Request More Info
              </OtwButton>
            </div>

            {statusById[dispute.id] ? (
              <div className="mt-2 text-sm text-green-400">{statusById[dispute.id]}</div>
            ) : null}
            {errorById[dispute.id] ? (
              <div className="mt-2 text-sm text-red-400">{errorById[dispute.id]}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
