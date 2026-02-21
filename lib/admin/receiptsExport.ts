import type { Prisma, ReceiptStatus } from '@prisma/client';

const RECEIPT_STATUSES: ReceiptStatus[] = ['APPROVED', 'FLAGGED', 'REJECTED', 'PENDING'];
const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_EXPORT_LIMIT = 10_000;
const MAX_EXPORT_LIMIT = 10_000;
const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 1_000;

export type ReceiptExportFormat = 'csv' | 'json';

export type ReceiptExportFilters = {
  format: ReceiptExportFormat;
  includeRaw: boolean;
  includeHash: boolean;
  nested: boolean;
  statuses: ReceiptStatus[];
  minRisk: number | null;
  maxRisk: number | null;
  vendor: string | null;
  userId: string | null;
  deliveryRequestId: string | null;
  startAt: Date;
  endAt: Date;
  limit: number;
  cursor: string | null;
  take: number;
};

type CsvRow = Record<string, string | number | null | undefined>;

export type ReceiptExportDeliveryRequest = {
  id: string;
  createdAt: Date;
  userId: string;
  restaurantName: string | null;
  receiptVendor: string | null;
  receiptSubtotalCents: number | null;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  deliveryFeeCents: number | null;
  tipCents: number;
  discountCents: number | null;
  serviceMilesFinal: number | null;
  isLocked: boolean;
  lockedAt: Date | null;
  lockReason: string | null;
  refundPolicy: string;
  orderConfirmation: {
    id: string;
    customerConfirmed: boolean;
    confirmedAt: Date | null;
    disputeStatus: string;
    disputedItems: Prisma.JsonValue | null;
    resolutionNotes: string | null;
    refundAmount: Prisma.Decimal | null;
    resolvedAt: Date | null;
  } | null;
};

export type ReceiptExportRecord = {
  id: string;
  createdAt: Date;
  status: ReceiptStatus;
  riskScore: number;
  reasonCodes: string[];
  merchantName: string | null;
  expectedVendor: string | null;
  receiptDate: Date | null;
  currency: string | null;
  subtotalAmount: Prisma.Decimal | null;
  taxAmount: Prisma.Decimal | null;
  tipAmount: Prisma.Decimal | null;
  totalAmount: Prisma.Decimal | null;
  confidenceScore: number | null;
  imageHash: string;
  rawResponse?: Prisma.JsonValue | null;
  deliveryRequest: ReceiptExportDeliveryRequest;
};

export const RECEIPT_EXPORT_HEADERS = [
  'id',
  'createdAt',
  'status',
  'riskScore',
  'proofScore',
  'itemMatchScore',
  'imageQuality',
  'tamperScore',
  'locked',
  'reasonCodes',
  'merchantName',
  'vendorName',
  'expectedVendor',
  'receiptDate',
  'currency',
  'subtotalAmount',
  'taxAmount',
  'tipAmount',
  'totalAmount',
  'extractedTotal',
  'confidenceScore',
  'deliveryRequestId',
  'requestCreatedAt',
  'customerUserId',
  'expectedTotal',
  'orderStatus',
  'pickupAddress',
  'dropoffAddress',
  'deliveryFeeCents',
  'tipCents',
  'discountCents',
  'serviceMilesFinal',
  'isLocked',
  'lockedAt',
  'lockReason',
  'refundPolicy',
  'confirmationId',
  'customerConfirmed',
  'confirmedAt',
  'disputeStatus',
  'disputedItemsCount',
  'resolutionOutcome',
  'resolutionNotes',
  'refundAmount',
  'resolvedAt',
] as const;

const MISMATCH_REASON_CODES = [
  'MERCHANT_MISMATCH',
  'MERCHANT_WEAK_MATCH',
  'TOTAL_SMALL_MISMATCH',
  'TOTAL_MISMATCH',
  'TOTAL_LARGE_MISMATCH',
  'TOTAL_PERCENT_MISMATCH',
  'TOTAL_MATH_MISMATCH',
] as const;

export function getMismatchReasonCodes(): readonly string[] {
  return MISMATCH_REASON_CODES;
}

function toStartOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function toEndOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function parseYyyyMmDd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function parseNumberInRange(
  value: string | null,
  fieldName: string,
  min: number,
  max: number,
  integer = true
): { value: number | null; error: string | null } {
  if (value == null || value === '') return { value: null, error: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { value: null, error: `${fieldName} must be a number` };
  }
  if (integer && !Number.isInteger(parsed)) {
    return { value: null, error: `${fieldName} must be an integer` };
  }
  if (parsed < min || parsed > max) {
    return { value: null, error: `${fieldName} must be between ${min} and ${max}` };
  }
  return { value: parsed, error: null };
}

export function parseReceiptExportFilters(
  searchParams: URLSearchParams,
  now = new Date()
): { value: ReceiptExportFilters | null; errors: string[] } {
  const errors: string[] = [];

  const formatRaw = (searchParams.get('format') ?? 'csv').toLowerCase();
  const format: ReceiptExportFormat = formatRaw === 'json' ? 'json' : 'csv';
  if (!['csv', 'json'].includes(formatRaw)) {
    errors.push('format must be csv or json');
  }

  const startRaw = searchParams.get('start');
  const endRaw = searchParams.get('end');
  const parsedStart = startRaw ? parseYyyyMmDd(startRaw) : null;
  const parsedEnd = endRaw ? parseYyyyMmDd(endRaw) : null;

  if (startRaw && !parsedStart) errors.push('start must be YYYY-MM-DD');
  if (endRaw && !parsedEnd) errors.push('end must be YYYY-MM-DD');

  let startAt: Date;
  let endAt: Date;
  if (parsedStart && parsedEnd) {
    startAt = toStartOfUtcDay(parsedStart);
    endAt = toEndOfUtcDay(parsedEnd);
  } else if (parsedStart) {
    startAt = toStartOfUtcDay(parsedStart);
    endAt = now;
  } else if (parsedEnd) {
    endAt = toEndOfUtcDay(parsedEnd);
    const base = new Date(endAt);
    base.setUTCDate(base.getUTCDate() - DEFAULT_RANGE_DAYS);
    startAt = toStartOfUtcDay(base);
  } else {
    endAt = now;
    const base = new Date(now);
    base.setUTCDate(base.getUTCDate() - DEFAULT_RANGE_DAYS);
    startAt = toStartOfUtcDay(base);
  }

  if (startAt > endAt) {
    errors.push('start cannot be after end');
  }

  const statusRaw = searchParams.get('status');
  const statuses = statusRaw
    ? statusRaw
        .split(',')
        .map((status) => status.trim().toUpperCase())
        .filter(Boolean)
    : [...RECEIPT_STATUSES];

  const invalidStatuses = statuses.filter((status) => !RECEIPT_STATUSES.includes(status as ReceiptStatus));
  if (invalidStatuses.length > 0) {
    errors.push(`invalid status values: ${invalidStatuses.join(',')}`);
  }

  const minRiskParsed = parseNumberInRange(searchParams.get('minRisk'), 'minRisk', 0, 100);
  if (minRiskParsed.error) errors.push(minRiskParsed.error);

  const maxRiskParsed = parseNumberInRange(searchParams.get('maxRisk'), 'maxRisk', 0, 100);
  if (maxRiskParsed.error) errors.push(maxRiskParsed.error);

  const minRisk = minRiskParsed.value;
  const maxRisk = maxRiskParsed.value;
  if (minRisk != null && maxRisk != null && minRisk > maxRisk) {
    errors.push('minRisk cannot be greater than maxRisk');
  }

  const limitParsed = parseNumberInRange(
    searchParams.get('limit'),
    'limit',
    1,
    MAX_EXPORT_LIMIT
  );
  if (limitParsed.error) errors.push(limitParsed.error);
  const limit = limitParsed.value ?? DEFAULT_EXPORT_LIMIT;

  const takeParsed = parseNumberInRange(
    searchParams.get('take'),
    'take',
    1,
    MAX_PAGE_SIZE
  );
  if (takeParsed.error) errors.push(takeParsed.error);
  const take = takeParsed.value ?? DEFAULT_PAGE_SIZE;

  const includeRaw = searchParams.get('includeRaw') === '1';
  const includeHash = searchParams.get('includeHash') === '1';
  const nested = searchParams.get('nested') === '1';

  const vendor = searchParams.get('vendor')?.trim() || null;
  const userId = searchParams.get('userId')?.trim() || null;
  const deliveryRequestId = searchParams.get('deliveryRequestId')?.trim() || null;
  const cursor = searchParams.get('cursor')?.trim() || null;

  if (errors.length > 0) {
    return { value: null, errors };
  }

  return {
    value: {
      format,
      includeRaw,
      includeHash,
      nested,
      statuses: statuses as ReceiptStatus[],
      minRisk,
      maxRisk,
      vendor,
      userId,
      deliveryRequestId,
      startAt,
      endAt,
      limit,
      cursor,
      take,
    },
    errors: [],
  };
}

export function buildReceiptExportWhere(filters: ReceiptExportFilters): Prisma.ReceiptVerificationWhereInput {
  const riskScoreWhere: Prisma.IntFilter = {};
  if (filters.minRisk != null) riskScoreWhere.gte = filters.minRisk;
  if (filters.maxRisk != null) riskScoreWhere.lte = filters.maxRisk;

  const where: Prisma.ReceiptVerificationWhereInput = {
    createdAt: {
      gte: filters.startAt,
      lte: filters.endAt,
    },
    ...(filters.statuses.length > 0 && filters.statuses.length < RECEIPT_STATUSES.length
      ? { status: { in: filters.statuses } }
      : {}),
    ...(Object.keys(riskScoreWhere).length > 0 ? { riskScore: riskScoreWhere } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.deliveryRequestId ? { deliveryRequestId: filters.deliveryRequestId } : {}),
  };

  if (filters.vendor) {
    where.OR = [
      { merchantName: { contains: filters.vendor, mode: 'insensitive' } },
      { expectedVendor: { contains: filters.vendor, mode: 'insensitive' } },
      {
        deliveryRequest: {
          is: {
            OR: [
              { restaurantName: { contains: filters.vendor, mode: 'insensitive' } },
              { receiptVendor: { contains: filters.vendor, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  return where;
}

function toMoneyString(value: Prisma.Decimal | number | string | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
  }
  const asDecimal = value as unknown as { toFixed?: (digits?: number) => string };
  if (typeof asDecimal.toFixed === 'function') return asDecimal.toFixed(2);
  return String(value);
}

function centsToMoneyString(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

function toIso(value: Date | null | undefined): string {
  return value ? value.toISOString() : '';
}

export function flattenReceiptExportRecord(
  record: ReceiptExportRecord,
  options?: { includeHash?: boolean }
): CsvRow {
  const confirmation = record.deliveryRequest.orderConfirmation;
  const disputedItemsCount = Array.isArray(confirmation?.disputedItems)
    ? confirmation.disputedItems.length
    : 0;
  const vendorName = record.deliveryRequest.restaurantName ?? record.deliveryRequest.receiptVendor ?? '';
  const row: CsvRow = {
    id: record.id,
    createdAt: toIso(record.createdAt),
    status: record.status,
    riskScore: record.riskScore,
    proofScore: record.proofScore ?? '',
    itemMatchScore: record.itemMatchScore ?? '',
    imageQuality: record.imageQuality ?? '',
    tamperScore: record.tamperScore ?? '',
    locked: record.locked ? 'true' : 'false',
    reasonCodes: record.reasonCodes.join('|'),
    merchantName: record.merchantName ?? '',
    vendorName: record.vendorName ?? '',
    expectedVendor: record.expectedVendor ?? '',
    receiptDate: toIso(record.receiptDate),
    currency: record.currency ?? '',
    subtotalAmount: toMoneyString(record.subtotalAmount),
    taxAmount: toMoneyString(record.taxAmount),
    tipAmount: toMoneyString(record.tipAmount),
    totalAmount: toMoneyString(record.totalAmount),
    extractedTotal: record.extractedTotal ?? '',
    confidenceScore: record.confidenceScore ?? '',
    deliveryRequestId: record.deliveryRequest.id,
    requestCreatedAt: toIso(record.deliveryRequest.createdAt),
    customerUserId: record.deliveryRequest.userId,
    expectedTotal: centsToMoneyString(record.deliveryRequest.receiptSubtotalCents),
    orderStatus: record.deliveryRequest.status,
    pickupAddress: record.deliveryRequest.pickupAddress,
    dropoffAddress: record.deliveryRequest.dropoffAddress,
    deliveryFeeCents: record.deliveryRequest.deliveryFeeCents ?? '',
    tipCents: record.deliveryRequest.tipCents ?? '',
    discountCents: record.deliveryRequest.discountCents ?? '',
    serviceMilesFinal: record.deliveryRequest.serviceMilesFinal ?? '',
    isLocked: record.deliveryRequest.isLocked ? 'true' : 'false',
    lockedAt: toIso(record.deliveryRequest.lockedAt),
    lockReason: record.deliveryRequest.lockReason ?? '',
    refundPolicy: record.deliveryRequest.refundPolicy,
    confirmationId: confirmation?.id ?? '',
    customerConfirmed: confirmation?.customerConfirmed ? 'true' : 'false',
    confirmedAt: toIso(confirmation?.confirmedAt ?? null),
    disputeStatus: confirmation?.disputeStatus ?? 'NONE',
    disputedItemsCount,
    resolutionOutcome: confirmation?.disputeStatus ?? '',
    resolutionNotes: confirmation?.resolutionNotes ?? '',
    refundAmount: toMoneyString(confirmation?.refundAmount ?? null),
    resolvedAt: toIso(confirmation?.resolvedAt ?? null),
  };

  if (options?.includeHash) {
    row.imageHash = record.imageHash;
  }

  return row;
}

export function buildJsonReceiptExportRecord(
  record: ReceiptExportRecord,
  options?: { includeRaw?: boolean; includeHash?: boolean; nested?: boolean }
): Record<string, unknown> {
  const vendorName = record.deliveryRequest.restaurantName ?? record.deliveryRequest.receiptVendor ?? null;
  const confirmation = record.deliveryRequest.orderConfirmation;
  const disputedItemsCount = Array.isArray(confirmation?.disputedItems)
    ? confirmation.disputedItems.length
    : 0;
  const receiptBlock = {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    status: record.status,
    riskScore: record.riskScore,
    proofScore: record.proofScore,
    itemMatchScore: record.itemMatchScore,
    imageQuality: record.imageQuality,
    tamperScore: record.tamperScore,
    locked: record.locked,
    reasonCodes: record.reasonCodes,
    merchantName: record.merchantName,
    vendorName: record.vendorName,
    expectedVendor: record.expectedVendor,
    receiptDate: record.receiptDate?.toISOString() ?? null,
    currency: record.currency,
    subtotalAmount: toMoneyString(record.subtotalAmount) || null,
    taxAmount: toMoneyString(record.taxAmount) || null,
    tipAmount: toMoneyString(record.tipAmount) || null,
    totalAmount: toMoneyString(record.totalAmount) || null,
    extractedTotal: record.extractedTotal,
    confidenceScore: record.confidenceScore,
    ...(options?.includeHash ? { imageHash: record.imageHash } : {}),
    ...(options?.includeRaw ? { rawResponse: record.rawResponse ?? null } : {}),
  };

  const deliveryRequestBlock = {
    deliveryRequestId: record.deliveryRequest.id,
    requestCreatedAt: record.deliveryRequest.createdAt.toISOString(),
    customerUserId: record.deliveryRequest.userId,
    vendorName,
    expectedTotal: centsToMoneyString(record.deliveryRequest.receiptSubtotalCents) || null,
    orderStatus: record.deliveryRequest.status,
    pickupAddress: record.deliveryRequest.pickupAddress,
    dropoffAddress: record.deliveryRequest.dropoffAddress,
    deliveryFeeCents: record.deliveryRequest.deliveryFeeCents,
    tipCents: record.deliveryRequest.tipCents,
    discountCents: record.deliveryRequest.discountCents,
    serviceMilesFinal: record.deliveryRequest.serviceMilesFinal,
    isLocked: record.deliveryRequest.isLocked,
    lockedAt: record.deliveryRequest.lockedAt?.toISOString() ?? null,
    lockReason: record.deliveryRequest.lockReason,
    refundPolicy: record.deliveryRequest.refundPolicy,
    confirmationId: confirmation?.id ?? null,
    customerConfirmed: confirmation?.customerConfirmed ?? false,
    confirmedAt: confirmation?.confirmedAt?.toISOString() ?? null,
    disputeStatus: confirmation?.disputeStatus ?? 'NONE',
    disputedItemsCount,
    resolutionOutcome: confirmation?.disputeStatus ?? null,
    resolutionNotes: confirmation?.resolutionNotes ?? null,
    refundAmount: toMoneyString(confirmation?.refundAmount ?? null) || null,
    resolvedAt: confirmation?.resolvedAt?.toISOString() ?? null,
  };

  if (options?.nested) {
    return {
      receipt: receiptBlock,
      deliveryRequest: deliveryRequestBlock,
    };
  }

  return {
    ...receiptBlock,
    ...deliveryRequestBlock,
  };
}

export function getReceiptExportCsvHeaders(includeHash = false): string[] {
  if (!includeHash) return [...RECEIPT_EXPORT_HEADERS];
  return [...RECEIPT_EXPORT_HEADERS, 'imageHash'];
}

export function escapeCsv(value: unknown): string {
  if (value == null) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function toCsvLine(values: unknown[]): string {
  return values.map(escapeCsv).join(',');
}

export function getDefaultExportLimit(): number {
  return DEFAULT_EXPORT_LIMIT;
}

export function parseReceiptSummaryRange(
  searchParams: URLSearchParams,
  now = new Date()
): { value: { startAt: Date; endAt: Date } | null; errors: string[] } {
  const errors: string[] = [];

  const startRaw = searchParams.get('start');
  const endRaw = searchParams.get('end');
  const parsedStart = startRaw ? parseYyyyMmDd(startRaw) : null;
  const parsedEnd = endRaw ? parseYyyyMmDd(endRaw) : null;

  if (startRaw && !parsedStart) errors.push('start must be YYYY-MM-DD');
  if (endRaw && !parsedEnd) errors.push('end must be YYYY-MM-DD');

  let startAt: Date;
  let endAt: Date;
  if (parsedStart && parsedEnd) {
    startAt = toStartOfUtcDay(parsedStart);
    endAt = toEndOfUtcDay(parsedEnd);
  } else if (parsedStart) {
    startAt = toStartOfUtcDay(parsedStart);
    endAt = now;
  } else if (parsedEnd) {
    endAt = toEndOfUtcDay(parsedEnd);
    const base = new Date(endAt);
    base.setUTCDate(base.getUTCDate() - DEFAULT_RANGE_DAYS);
    startAt = toStartOfUtcDay(base);
  } else {
    endAt = now;
    const base = new Date(now);
    base.setUTCDate(base.getUTCDate() - DEFAULT_RANGE_DAYS);
    startAt = toStartOfUtcDay(base);
  }

  if (startAt > endAt) {
    errors.push('start cannot be after end');
  }

  if (errors.length > 0) {
    return { value: null, errors };
  }

  return {
    value: { startAt, endAt },
    errors: [],
  };
}
