import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/db';

type RawBase64UsageRow = {
  countWithBase64: bigint | number | string | null;
  totalBytes: bigint | number | string | null;
  avgBytes: bigint | number | string | null;
  maxBytes: bigint | number | string | null;
  oldestUploadedAt: Date | string | null;
  expiringSoonCount: bigint | number | string | null;
};

export type PickupPassBase64UsageMetrics = {
  countWithBase64: number;
  totalBytes: number;
  avgBytes: number;
  maxBytes: number;
  oldestUploadedAt: string | null;
  expiringSoonCount: number;
};

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toIsoStringOrNull(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

export async function getPickupPassBase64UsageMetrics(): Promise<PickupPassBase64UsageMetrics> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<RawBase64UsageRow[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE "pickupPassBase64" IS NOT NULL) AS "countWithBase64",
      COALESCE(SUM(LENGTH("pickupPassBase64")), 0) AS "totalBytes",
      COALESCE(AVG(LENGTH("pickupPassBase64")), 0) AS "avgBytes",
      COALESCE(MAX(LENGTH("pickupPassBase64")), 0) AS "maxBytes",
      MIN("pickupPassUploadedAt") FILTER (WHERE "pickupPassBase64" IS NOT NULL) AS "oldestUploadedAt",
      COUNT(*) FILTER (
        WHERE "pickupPassBase64" IS NOT NULL
          AND "pickupPassExpiresAt" IS NOT NULL
          AND "pickupPassExpiresAt" <= NOW() + INTERVAL '48 hours'
      ) AS "expiringSoonCount"
    FROM "DeliveryRequest";
  `);

  const row = rows[0];

  return {
    countWithBase64: toNumber(row?.countWithBase64),
    totalBytes: toNumber(row?.totalBytes),
    avgBytes: toNumber(row?.avgBytes),
    maxBytes: toNumber(row?.maxBytes),
    oldestUploadedAt: toIsoStringOrNull(row?.oldestUploadedAt),
    expiringSoonCount: toNumber(row?.expiringSoonCount),
  };
}
