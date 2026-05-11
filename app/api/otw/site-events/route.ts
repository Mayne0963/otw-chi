export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { extractNeonAuthUserId, getNeonSession } from '@/lib/auth/server';

const eventTypeSchema = z.enum([
  'PAGE_VIEW',
  'CTA_CLICK',
  'SERVICE_VIEW',
  'SERVICE_SELECTED',
  'REQUEST_STARTED',
  'REQUEST_STEP_COMPLETED',
  'REQUEST_SUBMITTED',
  'REQUEST_ABANDONED_SIGNAL',
  'MEMBERSHIP_VIEW',
  'MEMBERSHIP_SELECTED',
  'MEMBERSHIP_CHECKOUT_STARTED',
  'MEMBERSHIP_CHECKOUT_COMPLETED',
  'LOGIN_REQUIRED',
  'DRIVER_APPLICATION_STARTED',
  'DRIVER_APPLICATION_SUBMITTED',
  'CONTACT_SUBMITTED',
  'SUPPORT_CLICKED',
  'ERROR_SHOWN',
]);

const serviceTypeSchema = z.enum([
  'FOOD_DELIVERY',
  'STORE_PICKUP',
  'FRAGILE_ITEM',
  'PERSONAL_ERRAND',
  'RIDE_SERVICE',
  'PEER_TO_PEER',
  'EVENT_SUPPORT',
  'HOME_WAIT_SERVICE',
  'OTHER',
]);

const MAX_METADATA_CHARS = 10_000;

const eventSchema = z
  .object({
    sessionId: z.string().trim().min(8).max(120),
    userId: z.string().trim().min(1).max(80).optional(),
    eventType: eventTypeSchema,
    page: z.string().trim().min(1).max(500).optional(),
    serviceType: serviceTypeSchema.nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

function readIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function safeJsonSize(value: unknown): number {
  try {
    return JSON.stringify(value ?? {}).length;
  } catch {
    return MAX_METADATA_CHARS + 1;
  }
}

export async function POST(request: Request) {
  const ip = readIp(request);
  const limit = rateLimit({ key: `otw:events:${ip}`, intervalMs: 10_000, max: 40 });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (parsed.data.metadata && safeJsonSize(parsed.data.metadata) > MAX_METADATA_CHARS) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const session = await getNeonSession();
    const neonAuthUserId = extractNeonAuthUserId(session);

    const prisma = getPrisma();
    let resolvedUserId: string | null = null;
    let resolvedCustomerProfileId: string | null = null;

    if (neonAuthUserId) {
      const user = await prisma.user
        .findUnique({
          where: { neonAuthId: neonAuthUserId },
          select: {
            id: true,
            customerProfile: { select: { id: true } },
          },
        })
        .catch(() => null);
      resolvedUserId = user?.id ?? null;
      resolvedCustomerProfileId = user?.customerProfile?.id ?? null;
    }

    await prisma.otwSiteEvent.create({
      data: {
        sessionId: parsed.data.sessionId,
        userId: resolvedUserId ?? undefined,
        customerProfileId: resolvedCustomerProfileId ?? undefined,
        eventType: parsed.data.eventType,
        page: parsed.data.page ?? undefined,
        serviceType: parsed.data.serviceType ?? undefined,
        metadata: (parsed.data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[otw:site-events] error', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
