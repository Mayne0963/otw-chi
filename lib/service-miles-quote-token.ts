import crypto from 'crypto';
import { z } from 'zod';
import { ServiceType } from '@prisma/client';

const payloadSchema = z
  .object({
    v: z.literal(1),
    userId: z.string().min(1),
    serviceType: z.nativeEnum(ServiceType),
    scheduledStart: z.string().datetime(),
    travelMinutes: z.number().int().nonnegative(),
    waitMinutes: z.number().int().nonnegative(),
    sitAndWait: z.boolean(),
    numberOfStops: z.number().int().positive(),
    returnOrExchange: z.boolean(),
    cashHandling: z.boolean(),
    peakHours: z.boolean(),
    advanceDiscountMax: z.number().int().nonnegative(),
    quotedAt: z.string().datetime(),
  })
  .strict();

export type ServiceMilesQuoteTokenPayload = z.infer<typeof payloadSchema>;

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecodeToBuffer(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

export function getServiceMilesQuoteTokenSecret(): string {
  const secret =
    process.env.SERVICE_MILES_QUOTE_SECRET ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    process.env.CRON_SECRET;

  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SERVICE_MILES_QUOTE_SECRET is required in production');
  }
  return 'dev-service-miles-quote-secret';
}

export function signServiceMilesQuoteToken(payload: ServiceMilesQuoteTokenPayload): string {
  const parsed = payloadSchema.parse(payload);
  const secret = getServiceMilesQuoteTokenSecret();

  const body = base64UrlEncode(JSON.stringify(parsed));
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  return `${body}.${base64UrlEncode(sig)}`;
}

export function verifyServiceMilesQuoteToken(token: string): ServiceMilesQuoteTokenPayload {
  const secret = getServiceMilesQuoteTokenSecret();
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Invalid quote token');

  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  const actual = base64UrlDecodeToBuffer(sig);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error('Invalid quote token signature');
  }

  const decoded = base64UrlDecodeToBuffer(body).toString('utf8');
  const json = JSON.parse(decoded) as unknown;
  return payloadSchema.parse(json);
}
