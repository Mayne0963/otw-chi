import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { purgeExpiredPickupPassBase64 } from '@/lib/pickup-pass';

const CRON_SECRET = process.env.OTW_CRON_SECRET ?? '';

function isAuthorizedCronRequest(req: Request): boolean {
  if (!CRON_SECRET) {
    return false;
  }

  const headerSecret = req.headers.get('x-otw-cron-secret');
  if (headerSecret && headerSecret === CRON_SECRET) {
    return true;
  }

  const authorization = req.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    return token.length > 0 && token === CRON_SECRET;
  }

  return false;
}

async function runPurge(req: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'OTW_CRON_SECRET is not configured' }, { status: 500 });
  }

  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const clearedCount = await purgeExpiredPickupPassBase64(prisma);

  return NextResponse.json({
    ok: true,
    clearedCount,
    clearedAt: new Date().toISOString(),
  });
}

export async function GET(req: Request) {
  return runPurge(req);
}

export async function POST(req: Request) {
  return runPurge(req);
}
