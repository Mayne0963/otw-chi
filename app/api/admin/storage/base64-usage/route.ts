export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPickupPassBase64UsageMetrics } from '@/lib/admin/base64-usage';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const metrics = await getPickupPassBase64UsageMetrics();

  return NextResponse.json({
    ...metrics,
    generatedAt: new Date().toISOString(),
  });
}
