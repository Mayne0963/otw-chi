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

  const [statusGroups, avgAggregate, totalCount, mismatchCount, duplicateCount, veryfiErrorCount, flaggedRows] =
    await Promise.all([
      prisma.receiptVerification.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.receiptVerification.aggregate({
        where,
        _avg: { riskScore: true },
      }),
      prisma.receiptVerification.count({ where }),
      prisma.receiptVerification.count({
        where: {
          ...where,
          reasonCodes: {
            hasSome: [...getMismatchReasonCodes()],
          },
        },
      }),
      prisma.receiptVerification.count({
        where: {
          ...where,
          reasonCodes: {
            has: 'DUPLICATE_RECEIPT',
          },
        },
      }),
      prisma.receiptVerification.count({
        where: {
          ...where,
          reasonCodes: {
            has: 'VERYFI_ERROR',
          },
        },
      }),
      prisma.receiptVerification.findMany({
        where: {
          ...where,
          status: 'FLAGGED',
        },
        select: {
          merchantName: true,
          expectedVendor: true,
          deliveryRequest: {
            select: {
              restaurantName: true,
              receiptVendor: true,
            },
          },
        },
        take: 10_000,
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

  const vendorCounts = new Map<string, { vendor: string; count: number }>();
  for (const row of flaggedRows) {
    const vendorCandidate =
      row.merchantName ??
      row.expectedVendor ??
      row.deliveryRequest.restaurantName ??
      row.deliveryRequest.receiptVendor ??
      'Unknown Vendor';
    const key = normalizeVendor(vendorCandidate) || 'unknown vendor';
    const existing = vendorCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      vendorCounts.set(key, { vendor: vendorCandidate, count: 1 });
    }
  }

  const topVendorsFlagged = [...vendorCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const mismatchRate = totalCount > 0 ? mismatchCount / totalCount : 0;

  return NextResponse.json({
    range: {
      start: startAt.toISOString(),
      end: endAt.toISOString(),
    },
    total: totalCount,
    countsByStatus,
    avgRiskScore: avgAggregate._avg.riskScore ?? 0,
    mismatchRate,
    mismatchRatePercent: Number((mismatchRate * 100).toFixed(2)),
    duplicatesCount: duplicateCount,
    veryfiErrorCount,
    topVendorsFlagged,
  });
}
