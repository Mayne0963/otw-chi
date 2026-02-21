import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/roles';
import { getMismatchReasonCodes, parseReceiptSummaryRange } from '@/lib/admin/receiptsExport';

export const dynamic = 'force-dynamic';

function normalizeVendor(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function GET(request: Request) {
  try {
    await requireRole(['ADMIN']);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  const prisma = getPrisma();
  const searchParams = new URL(request.url).searchParams;
  const parsedRange = parseReceiptSummaryRange(searchParams);
  if (!parsedRange.value) {
    return NextResponse.json({ error: 'Invalid query', details: parsedRange.errors }, { status: 400 });
  }

  const { startAt, endAt } = parsedRange.value;
  const where = {
    createdAt: {
      gte: startAt,
      lte: endAt,
    },
  } as const;

  const [statusGroups, avgAggregate, totalCount, lockedCount, totalApprovedRevenue] =
    await Promise.all([
      prisma.receiptVerification.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.receiptVerification.aggregate({
        where,
        _avg: { proofScore: true },
      }),
      prisma.receiptVerification.count({ where }),
      prisma.receiptVerification.count({ where: { ...where, locked: true } }),
      prisma.receiptVerification.aggregate({
        where: { ...where, status: 'APPROVED' },
        _sum: { extractedTotal: true },
      }),
    ]);

  const countsByStatus: Record<string, number> = {
    APPROVED: 0,
    FLAGGED: 0,
    REJECTED: 0,
    PENDING: 0,
  };
  for (const group of statusGroups) {
    countsByStatus[group.status] = group._count._all;
  }

  return NextResponse.json({
    range: {
      start: startAt.toISOString(),
      end: endAt.toISOString(),
    },
    totalReceipts: totalCount,
    approvedCount: countsByStatus['APPROVED'] ?? 0,
    flaggedCount: countsByStatus['FLAGGED'] ?? 0,
    rejectedCount: countsByStatus['REJECTED'] ?? 0,
    avgProofScore: avgAggregate._avg.proofScore ?? 0,
    lockedCount: lockedCount,
    totalApprovedRevenue: totalApprovedRevenue._sum.extractedTotal ?? 0,
  });
}
