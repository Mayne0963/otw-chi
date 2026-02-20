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
  disputedItems: Array<{ itemKey?: string; name?: string; qtyDisputed?: number; reason?: string; details?: string }>;
  resolutionNotes: string | null;
  refundAmount: string | null;
  receiptVerification: {
    id: string;
    status: string;
    riskScore: number;
    totalAmount: string | null;
  } | null;
};

type Props = {
  disputes: DisputeRow[];
};

type Resolution = 'APPROVED' | 'DENIED' | 'NEEDS_INFO';

export default function DisputeResolutionTable({ disputes }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
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

  const resolveDispute = async (id: string, resolution: Resolution) => {
    setPendingId(id);
    setErrorById((prev) => ({ ...prev, [id]: '' }));
    setStatusById((prev) => ({ ...prev, [id]: '' }));

    try {
      const payload: { resolution: Resolution; notes?: string; refundAmount?: string } = {
        resolution,
      };
      const notes = notesById[id]?.trim();
      const refundAmount = refundById[id]?.trim();
      if (notes) payload.notes = notes;
      if (resolution === 'APPROVED' && refundAmount) payload.refundAmount = refundAmount;

      const response = await fetch(`/api/admin/disputes/${id}/resolve`, {
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
        [id]: `Updated: ${data.disputeStatus ?? resolution}`,
      }));
      window.location.reload();
    } catch (error) {
      setErrorById((prev) => ({
        ...prev,
        [id]: error instanceof Error ? error.message : 'Failed to resolve dispute',
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
      {ordered.map((dispute) => (
        <div key={dispute.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-white">Confirmation {dispute.id}</div>
              <div className="text-xs text-white/60">
                Request {dispute.deliveryRequestId} • Status {dispute.disputeStatus}
              </div>
            </div>
            <div className="text-xs text-white/60">
              Confirmed: {dispute.customerConfirmed ? (dispute.confirmedAt ?? 'yes') : 'no'}
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
                <div className="mt-2 text-sm text-white/60">No disputed items saved.</div>
              )}
              {dispute.disputeNotes && (
                <div className="mt-2 text-xs text-white/70">Notes: {dispute.disputeNotes}</div>
              )}
              {dispute.evidenceUrls.length > 0 && (
                <div className="mt-2 space-y-1 text-xs text-otwGold">
                  {dispute.evidenceUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="block underline">
                      {url}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-xs uppercase tracking-wide text-white/60">Receipt Proof</div>
              {dispute.receiptVerification ? (
                <div className="mt-2 text-sm text-white/80 space-y-1">
                  <div>Verification: {dispute.receiptVerification.id}</div>
                  <div>Status: {dispute.receiptVerification.status}</div>
                  <div>Risk Score: {dispute.receiptVerification.riskScore}</div>
                  <div>Total: {dispute.receiptVerification.totalAmount ?? '—'}</div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-white/60">No linked receipt verification.</div>
              )}
              {dispute.resolutionNotes && (
                <div className="mt-2 text-xs text-white/70">Resolution: {dispute.resolutionNotes}</div>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <textarea
              value={notesById[dispute.id] ?? ''}
              onChange={(event) =>
                setNotesById((prev) => ({ ...prev, [dispute.id]: event.target.value }))
              }
              placeholder="Resolution notes"
              className="min-h-[70px] rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-white"
            />
            <input
              type="text"
              value={refundById[dispute.id] ?? ''}
              onChange={(event) =>
                setRefundById((prev) => ({ ...prev, [dispute.id]: event.target.value }))
              }
              placeholder="Refund amount (for approvals)"
              className="rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-white"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <OtwButton
              variant="gold"
              disabled={pendingId === dispute.id}
              onClick={() => resolveDispute(dispute.id, 'APPROVED')}
            >
              Approve Refund
            </OtwButton>
            <OtwButton
              variant="red"
              disabled={pendingId === dispute.id}
              onClick={() => resolveDispute(dispute.id, 'DENIED')}
            >
              Deny
            </OtwButton>
            <OtwButton
              variant="outline"
              disabled={pendingId === dispute.id}
              onClick={() => resolveDispute(dispute.id, 'NEEDS_INFO')}
            >
              Request More Info
            </OtwButton>
          </div>

          {statusById[dispute.id] && <div className="mt-2 text-sm text-green-400">{statusById[dispute.id]}</div>}
          {errorById[dispute.id] && <div className="mt-2 text-sm text-red-400">{errorById[dispute.id]}</div>}
        </div>
      ))}
    </div>
  );
}
