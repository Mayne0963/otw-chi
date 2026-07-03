export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { getSlackWebhookUrl, postToSlackWebhook } from '@/lib/services/slack';

const interestTypeSchema = z.enum([
  'SERVICE_REQUEST',
  'MEMBERSHIP_INTEREST',
  'DRIVER_INTEREST',
  'BUSINESS_ACCOUNT',
  'FRAGILE_DELIVERY',
  'STORE_PICKUP',
  'FOOD_DELIVERY',
  'ERRAND_SERVICE',
  'PEER_TO_PEER_DELIVERY',
  'GENERAL_CONTACT',
  'LAUNCH_LIST',
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

const MAX_MESSAGE_CHARS = 4000;
const MAX_METADATA_CHARS = 10_000;

const leadSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(254).optional(),
    phone: z.string().trim().min(7).max(40).optional(),
    interestType: interestTypeSchema,
    serviceType: serviceTypeSchema.optional(),
    sourcePage: z.string().trim().min(1).max(500).optional(),
    message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.email || value.phone || value.message),
    { message: 'At least one of email, phone, or message is required.' },
  );

function safeJsonSize(value: unknown): number {
  try {
    return JSON.stringify(value ?? {}).length;
  } catch {
    return MAX_METADATA_CHARS + 1;
  }
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatLeadSlackAlert(input: {
  interestType: string;
  serviceType: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  sourcePage: string | null;
}) {
  const who = [input.name, input.email, input.phone].filter(Boolean).join(' / ') || 'Unknown';
  const service = input.serviceType ? ` / ${input.serviceType}` : '';
  const source = input.sourcePage ? ` from ${input.sourcePage}` : '';
  return `New OTW lead: ${input.interestType}${service} — ${who}${source}`;
}

function resolveLeadSlackWebhookUrl(): string | null {
  return (
    getSlackWebhookUrl('SLACK_ALERTS_WEBHOOK_URL') ||
    getSlackWebhookUrl('SLACK_OTW_WEBHOOK_URL') ||
    getSlackWebhookUrl('SLACK_OTW_INTAKE_WEBHOOK_URL') ||
    getSlackWebhookUrl('SLACK_OTW_REQUESTS_WEBHOOK_URL') ||
    getSlackWebhookUrl('SLACK_ORDERS_WEBHOOK_URL') ||
    null
  );
}

const HIGH_VALUE_INTEREST_TYPES = new Set<string>([
  'BUSINESS_ACCOUNT',
  'DRIVER_INTEREST',
  'MEMBERSHIP_INTEREST',
  'FRAGILE_DELIVERY',
  'SERVICE_REQUEST',
]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid lead payload' }, { status: 400 });
    }

    if (parsed.data.metadata && safeJsonSize(parsed.data.metadata) > MAX_METADATA_CHARS) {
      return NextResponse.json({ error: 'metadata is too large' }, { status: 400 });
    }

    const prisma = getPrisma();
    const created = await prisma.otwLead.create({
      data: {
        name: normalizeOptionalText(parsed.data.name) ?? undefined,
        email: normalizeOptionalText(parsed.data.email) ?? undefined,
        phone: normalizeOptionalText(parsed.data.phone) ?? undefined,
        interestType: parsed.data.interestType,
        serviceType: parsed.data.serviceType ?? undefined,
        sourcePage: normalizeOptionalText(parsed.data.sourcePage) ?? undefined,
        message: normalizeOptionalText(parsed.data.message) ?? undefined,
        metadata: (parsed.data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      select: { id: true },
    });

    if (HIGH_VALUE_INTEREST_TYPES.has(parsed.data.interestType)) {
      const webhookUrl = resolveLeadSlackWebhookUrl();
      if (webhookUrl) {
        postToSlackWebhook({
          webhookUrl,
          text: formatLeadSlackAlert({
            interestType: parsed.data.interestType,
            serviceType: parsed.data.serviceType ?? null,
            name: normalizeOptionalText(parsed.data.name),
            email: normalizeOptionalText(parsed.data.email),
            phone: normalizeOptionalText(parsed.data.phone),
            sourcePage: normalizeOptionalText(parsed.data.sourcePage),
          }),
        }).catch((error) => {
          console.warn('[otw:leads] Slack alert failed', error);
        });
      }
    }

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    console.error('[otw:leads] error', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
