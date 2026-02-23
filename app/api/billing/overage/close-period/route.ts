import { NextResponse } from 'next/server';
import { OverageStatus } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { closePeriodForUser, getPreviousPeriodKey } from '@/lib/overage-invoice';

export const runtime = 'nodejs';

function getCronSecret() {
  return process.env.OTW_CRON_SECRET || process.env.CRON_SECRET || '';
}

function isAuthorized(req: Request, secret: string) {
  if (!secret) return false;

  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';
  const customToken = req.headers.get('x-otw-cron-secret')?.trim() || '';

  return bearerToken === secret || customToken === secret;
}

function normalizePeriodKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (!/^\d{4}-\d{2}$/.test(key)) return null;
  return key;
}

async function resolvePeriodKey(req: Request): Promise<string> {
  const url = new URL(req.url);
  const queryPeriodKey = normalizePeriodKey(url.searchParams.get('periodKey'));
  if (queryPeriodKey) return queryPeriodKey;

  if (req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { periodKey?: unknown } | null;
    const bodyPeriodKey = normalizePeriodKey(body?.periodKey);
    if (bodyPeriodKey) return bodyPeriodKey;
  }

  return getPreviousPeriodKey(new Date(), 'America/Chicago');
}

async function handleClosePeriod(req: Request) {
  const secret = getCronSecret();
  if (!secret) {
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
  }

  if (!isAuthorized(req, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const periodKey = await resolvePeriodKey(req);
  const prisma = getPrisma();

  const periods = await prisma.overageInvoicePeriod.findMany({
    where: {
      periodKey,
      status: OverageStatus.PENDING,
      totalCents: { gt: 0 },
    },
    select: {
      id: true,
      userId: true,
      periodKey: true,
      totalCents: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let invoiced = 0;
  let skipped = 0;
  let failed = 0;
  const failures: Array<{ userId: string; periodId: string; reason: string }> = [];

  for (const period of periods) {
    try {
      const result = await closePeriodForUser(period.userId, periodKey);
      if (result.invoiced) {
        invoiced += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      failures.push({
        userId: period.userId,
        periodId: period.id,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    periodKey,
    total: periods.length,
    invoiced,
    skipped,
    failed,
    failures,
  });
}

export async function GET(req: Request) {
  return handleClosePeriod(req);
}

export async function POST(req: Request) {
  return handleClosePeriod(req);
}
