import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export const PICKUP_PASS_EXPIRY_DAYS = 14;
export const PICKUP_PASS_MAX_BYTES_STORAGE = 5 * 1024 * 1024;
export const PICKUP_PASS_MAX_BYTES_BASE64 = 1 * 1024 * 1024;
export const PICKUP_PASS_BASE64_WARNING_BYTES = 250 * 1024 * 1024;
export const PICKUP_PASS_BASE64_DISABLE_BYTES = 500 * 1024 * 1024;
export const PICKUP_PASS_BASE64_EMERGENCY_BYTES = 1024 * 1024 * 1024;

type PickupPassDbClient = PrismaClient | Prisma.TransactionClient;

type RawTotalBytesRow = {
  totalBytes: bigint | number | string | null;
};

export type PickupPassBase64Pressure = 'healthy' | 'warning' | 'paused' | 'emergency';

export type PickupPassBase64CircuitStatus = {
  base64Mode: boolean;
  uploadsAllowed: boolean;
  overrideEnabled: boolean;
  pressure: PickupPassBase64Pressure;
  totalBytes: number;
  warningBytes: number;
  disableBytes: number;
  emergencyBytes: number;
};

const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isPickupPassExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() <= now.getTime();
}

export function toPickupPassDataUrl(base64: string, mimeType: string | null | undefined): string {
  const normalizedMime = typeof mimeType === 'string' && mimeType.trim().length > 0
    ? mimeType.trim()
    : 'image/webp';
  return `data:${normalizedMime};base64,${base64}`;
}

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

export function isBase64UploadOverrideEnabled(): boolean {
  const raw = process.env.OTW_BASE64_UPLOAD_OVERRIDE;
  if (!raw) {
    return false;
  }

  return TRUE_ENV_VALUES.has(raw.trim().toLowerCase());
}

export function getPickupPassBase64Pressure(totalBytes: number): PickupPassBase64Pressure {
  if (totalBytes >= PICKUP_PASS_BASE64_EMERGENCY_BYTES) {
    return 'emergency';
  }

  if (totalBytes >= PICKUP_PASS_BASE64_DISABLE_BYTES) {
    return 'paused';
  }

  if (totalBytes >= PICKUP_PASS_BASE64_WARNING_BYTES) {
    return 'warning';
  }

  return 'healthy';
}

export async function getPickupPassBase64TotalBytes(
  client: PickupPassDbClient,
): Promise<number> {
  const rows = await client.$queryRaw<RawTotalBytesRow[]>(Prisma.sql`
    SELECT
      COALESCE(SUM(LENGTH("pickupPassBase64")), 0) AS "totalBytes"
    FROM "DeliveryRequest"
    WHERE "pickupPassBase64" IS NOT NULL;
  `);

  return toNumber(rows[0]?.totalBytes);
}

export async function getPickupPassBase64CircuitStatus(
  client: PickupPassDbClient,
  base64Mode: boolean,
): Promise<PickupPassBase64CircuitStatus> {
  const totalBytes = base64Mode ? await getPickupPassBase64TotalBytes(client) : 0;
  const overrideEnabled = isBase64UploadOverrideEnabled();
  const pressure = getPickupPassBase64Pressure(totalBytes);
  const uploadsAllowed =
    !base64Mode || overrideEnabled || totalBytes < PICKUP_PASS_BASE64_DISABLE_BYTES;

  return {
    base64Mode,
    uploadsAllowed,
    overrideEnabled,
    pressure,
    totalBytes,
    warningBytes: PICKUP_PASS_BASE64_WARNING_BYTES,
    disableBytes: PICKUP_PASS_BASE64_DISABLE_BYTES,
    emergencyBytes: PICKUP_PASS_BASE64_EMERGENCY_BYTES,
  };
}

export async function purgeExpiredPickupPassForRequest(
  client: PickupPassDbClient,
  deliveryRequestId: string,
  now = new Date(),
): Promise<number> {
  const result = await client.deliveryRequest.updateMany({
    where: {
      id: deliveryRequestId,
      pickupPassBase64: { not: null },
      pickupPassExpiresAt: { lt: now },
    },
    data: {
      pickupPassBase64: null,
      pickupPassMimeType: null,
      pickupPassUploadedAt: null,
      pickupPassExpiresAt: null,
    },
  });

  return result.count;
}

export async function purgeExpiredPickupPassBase64(
  client: PickupPassDbClient,
  now = new Date(),
): Promise<number> {
  const result = await client.deliveryRequest.updateMany({
    where: {
      pickupPassBase64: { not: null },
      pickupPassExpiresAt: { lt: now },
    },
    data: {
      pickupPassBase64: null,
      pickupPassMimeType: null,
      pickupPassUploadedAt: null,
      pickupPassExpiresAt: null,
    },
  });

  return result.count;
}
