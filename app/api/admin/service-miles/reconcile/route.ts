import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/roles';
import { reconcileServiceMilesWallets } from '@/lib/service-miles-reconciliation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

function parseLimit(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const asInt = Math.trunc(parsed);
  if (asInt <= 0) return undefined;
  return asInt;
}

function parseUserId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function ensureAdmin() {
  try {
    return await requireRole(['ADMIN']);
  } catch (_error) {
    return null;
  }
}

export async function GET(req: Request) {
  const adminUser = await ensureAdmin();
  if (!adminUser) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(req.url);
  const result = await reconcileServiceMilesWallets({
    userId: parseUserId(url.searchParams.get('userId')),
    limit: parseLimit(url.searchParams.get('limit')),
    applyFix: false,
    writeAdjustmentEntry: false,
    actorLabel: adminUser.email ?? adminUser.id,
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const adminUser = await ensureAdmin();
  if (!adminUser) {
    return new Response('Forbidden', { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const applyFix = parseBoolean(body.applyFix, false);
  const writeAdjustmentEntry = parseBoolean(body.writeAdjustmentEntry, false);

  const result = await reconcileServiceMilesWallets({
    userId: parseUserId(body.userId),
    limit: parseLimit(body.limit),
    applyFix,
    writeAdjustmentEntry,
    actorLabel: adminUser.email ?? adminUser.id,
  });

  return NextResponse.json(result);
}
