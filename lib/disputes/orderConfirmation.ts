import { z } from 'zod';
import { computeBillableTotalAfterDiscountCents } from '@/lib/order-pricing';

export const disputeReasonSchema = z.enum(['MISSING', 'WRONG_ITEM', 'BAD_QUALITY', 'DAMAGED']);
export type DisputeReason = z.infer<typeof disputeReasonSchema>;

export const disputedItemInputSchema = z.object({
  itemIdOrName: z.string().min(1),
  qtyDisputed: z.number().int().positive(),
  reason: disputeReasonSchema,
  details: z.string().trim().max(1000).optional(),
});

export const disputePayloadSchema = z.object({
  disputedItems: z.array(disputedItemInputSchema).min(1),
  disputeNotes: z.string().trim().max(5000).optional(),
  evidenceUrls: z.array(z.string().url()).max(20).optional(),
});

export const confirmPayloadSchema = z.object({
  customerConfirmed: z.literal(true),
  itemsSnapshot: z
    .array(
      z.object({
        itemKey: z.string().optional(),
        name: z.string().min(1),
        qty: z.number().int().positive(),
        unitPrice: z.number().finite().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .optional(),
});

export type SnapshotItem = {
  itemKey: string;
  name: string;
  qty: number;
  unitPrice?: number;
  notes?: string;
};

export type DisputedItemInput = z.infer<typeof disputedItemInputSchema>;

export type NormalizedDisputedItem = {
  itemKey: string;
  name: string;
  qtyDisputed: number;
  reason: DisputeReason;
  details?: string;
};

type DeliveryRequestTotalInput = {
  serviceType: string;
  receiptSubtotalCents?: number | null;
  deliveryFeeCents?: number | null;
  receiptImageData?: string | null;
  receiptItems?: unknown;
  quoteBreakdown?: unknown;
  discountCents?: number | null;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parsePositiveInt(value: unknown, fallback = 1): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
}

function parseOptionalPrice(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  return Number(numeric.toFixed(2));
}

function pickName(item: Record<string, unknown>): string {
  const raw =
    item.name ??
    item.itemName ??
    item.description ??
    item.title ??
    item.item ??
    item.productName;
  return typeof raw === 'string' ? raw.trim() : '';
}

function pickQty(item: Record<string, unknown>): number {
  return parsePositiveInt(item.qty ?? item.quantity ?? item.count ?? 1, 1);
}

function pickUnitPrice(item: Record<string, unknown>): number | undefined {
  return parseOptionalPrice(item.unitPrice ?? item.price ?? item.amount ?? undefined);
}

function pickNotes(item: Record<string, unknown>): string | undefined {
  const raw = item.notes ?? item.note ?? item.details;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

function buildDefaultItemKey(name: string, index: number): string {
  const base = normalizeKey(name).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-');
  return `${base || 'item'}-${index + 1}`;
}

function normalizeItemKey(rawKey: string | undefined, name: string, index: number): string {
  const candidate = rawKey?.trim();
  if (!candidate) return buildDefaultItemKey(name, index);
  return candidate;
}

export function buildItemsSnapshot(input: unknown): SnapshotItem[] {
  if (!Array.isArray(input)) return [];

  const snapshot: SnapshotItem[] = [];
  input.forEach((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object') return;
    const item = rawItem as Record<string, unknown>;
    const name = pickName(item);
    if (!name) return;

    const itemKey = normalizeItemKey(
      typeof item.itemKey === 'string'
        ? item.itemKey
        : typeof item.id === 'string'
          ? item.id
          : undefined,
      name,
      index
    );
    const qty = pickQty(item);
    const unitPrice = pickUnitPrice(item);
    const notes = pickNotes(item);

    snapshot.push({
      itemKey,
      name,
      qty,
      ...(unitPrice != null ? { unitPrice } : {}),
      ...(notes ? { notes } : {}),
    });
  });

  return snapshot;
}

export function computeTotalSnapshotDecimal(input: DeliveryRequestTotalInput): string | null {
  const totalCents = computeBillableTotalAfterDiscountCents({
    serviceType: input.serviceType as 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE' | 'RIDE',
    receiptSubtotalCents: input.receiptSubtotalCents ?? undefined,
    deliveryFeeCents: input.deliveryFeeCents ?? undefined,
    receiptImageData: input.receiptImageData ?? undefined,
    receiptItems: Array.isArray(input.receiptItems) ? (input.receiptItems as { price?: number; quantity?: number }[]) : undefined,
    quoteBreakdown: input.quoteBreakdown,
    discountCents: input.discountCents ?? undefined,
  });

  if (!Number.isFinite(totalCents) || totalCents < 0) return null;
  return (totalCents / 100).toFixed(2);
}

export function validateDisputedItemsAgainstSnapshot(
  snapshot: SnapshotItem[],
  disputedItems: DisputedItemInput[]
): { valid: boolean; normalized: NormalizedDisputedItem[]; errors: string[] } {
  const errors: string[] = [];
  const normalized: NormalizedDisputedItem[] = [];

  const byKey = new Map<string, SnapshotItem>();
  const byName = new Map<string, SnapshotItem>();
  for (const item of snapshot) {
    byKey.set(normalizeKey(item.itemKey), item);
    byName.set(normalizeKey(item.name), item);
  }

  disputedItems.forEach((item, index) => {
    const lookup = normalizeKey(item.itemIdOrName);
    const match = byKey.get(lookup) ?? byName.get(lookup);
    if (!match) {
      errors.push(`disputedItems[${index}] does not match any confirmed item`);
      return;
    }

    if (item.qtyDisputed > match.qty) {
      errors.push(`disputedItems[${index}] qtyDisputed exceeds confirmed quantity`);
      return;
    }

    normalized.push({
      itemKey: match.itemKey,
      name: match.name,
      qtyDisputed: item.qtyDisputed,
      reason: item.reason,
      ...(item.details ? { details: item.details.trim() } : {}),
    });
  });

  return {
    valid: errors.length === 0,
    normalized,
    errors,
  };
}

export function requiresEvidenceForDispute(disputedItems: NormalizedDisputedItem[]): boolean {
  return disputedItems.some((item) => item.reason === 'MISSING' || item.reason === 'WRONG_ITEM');
}

export function shouldMarkNeedsInfoForDispute(
  customerConfirmed: boolean,
  disputedItems: NormalizedDisputedItem[],
  evidenceUrls: string[]
): boolean {
  if (!customerConfirmed) return true;
  if (requiresEvidenceForDispute(disputedItems) && evidenceUrls.length === 0) return true;
  return false;
}
