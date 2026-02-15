export type ReceiptItemLike = {
  price?: number | null;
  quantity?: number | null;
};

export type BillableOrderInput = {
  serviceType?: string | null;
  deliveryFeeCents?: number | null;
  discountCents?: number | null;
  receiptSubtotalCents?: number | null;
  receiptItems?: ReceiptItemLike[] | null;
  receiptImageData?: string | null;
  cashDelivery?: boolean | null;
  quoteBreakdown?: unknown;
};

const FOOD_SERVICE_TYPE = 'FOOD';

const asNonNegativeInt = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};

const hasReceiptUpload = (input: BillableOrderInput) => {
  if (typeof input.receiptImageData === 'string' && input.receiptImageData.trim().length > 0) {
    return true;
  }

  if (Array.isArray(input.receiptItems) && input.receiptItems.length > 0) {
    return true;
  }

  return asNonNegativeInt(input.receiptSubtotalCents) > 0;
};

const normalizeReceiptSubtotalCents = (input: BillableOrderInput) => {
  const explicit = asNonNegativeInt(input.receiptSubtotalCents);
  if (explicit > 0) return explicit;

  if (!Array.isArray(input.receiptItems)) return 0;

  return input.receiptItems.reduce((sum, item) => {
    const price = typeof item?.price === 'number' && Number.isFinite(item.price) ? item.price : 0;
    const quantity = typeof item?.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1;
    const lineTotal = Math.round(price * 100) * Math.max(1, Math.trunc(quantity));
    return sum + Math.max(0, lineTotal);
  }, 0);
};

export const isCashDelivery = (input: Pick<BillableOrderInput, 'cashDelivery' | 'quoteBreakdown'>) => {
  if (input.cashDelivery === true) return true;

  if (!input.quoteBreakdown || typeof input.quoteBreakdown !== 'object') return false;

  const breakdown = input.quoteBreakdown as Record<string, unknown>;

  if (typeof breakdown.cashDelivery === 'boolean') {
    return breakdown.cashDelivery;
  }

  const adders = breakdown.adders;
  if (!adders || typeof adders !== 'object') return false;

  const cashHandling = (adders as Record<string, unknown>).cashHandling;
  return typeof cashHandling === 'number' && Number.isFinite(cashHandling) && cashHandling > 0;
};

export const computeBillableReceiptSubtotalCents = (input: BillableOrderInput) => {
  const receiptSubtotalCents = normalizeReceiptSubtotalCents(input);

  const isFoodReceiptDelivery =
    String(input.serviceType || '').toUpperCase() === FOOD_SERVICE_TYPE && hasReceiptUpload(input);

  if (isFoodReceiptDelivery && !isCashDelivery(input)) {
    return 0;
  }

  return receiptSubtotalCents;
};

export const computeBillableBaseTotalCents = (input: BillableOrderInput) => {
  const deliveryFeeCents = asNonNegativeInt(input.deliveryFeeCents);
  const receiptSubtotalCents = computeBillableReceiptSubtotalCents(input);
  return deliveryFeeCents + receiptSubtotalCents;
};

export const computeBillableTotalAfterDiscountCents = (input: BillableOrderInput) => {
  const baseTotalCents = computeBillableBaseTotalCents(input);
  const discountCents = asNonNegativeInt(input.discountCents);
  return Math.max(0, baseTotalCents - discountCents);
};
