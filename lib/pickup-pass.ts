import type { Prisma, PrismaClient } from '@prisma/client';

export const PICKUP_PASS_EXPIRY_DAYS = 14;
export const PICKUP_PASS_MAX_BYTES_STORAGE = 5 * 1024 * 1024;
export const PICKUP_PASS_MAX_BYTES_BASE64 = 1 * 1024 * 1024;

type PickupPassDbClient = PrismaClient | Prisma.TransactionClient;

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
