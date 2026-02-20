import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/roles';
import {
  buildJsonReceiptExportRecord,
  buildReceiptExportWhere,
  flattenReceiptExportRecord,
  getReceiptExportCsvHeaders,
  parseReceiptExportFilters,
  toCsvLine,
  type ReceiptExportRecord,
} from '@/lib/admin/receiptsExport';

export const dynamic = 'force-dynamic';

const CSV_BATCH_SIZE = 1_000;

const buildSelect = (includeRaw: boolean) =>
  ({
    id: true,
    createdAt: true,
    status: true,
    riskScore: true,
    reasonCodes: true,
    merchantName: true,
    expectedVendor: true,
    receiptDate: true,
    currency: true,
    subtotalAmount: true,
    taxAmount: true,
    tipAmount: true,
    totalAmount: true,
    confidenceScore: true,
    imageHash: true,
    rawResponse: includeRaw,
    deliveryRequest: {
      select: {
        id: true,
        createdAt: true,
        userId: true,
        restaurantName: true,
        receiptVendor: true,
        receiptSubtotalCents: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        deliveryFeeCents: true,
        tipCents: true,
        discountCents: true,
        serviceMilesFinal: true,
        isLocked: true,
        lockedAt: true,
        lockReason: true,
        refundPolicy: true,
        orderConfirmation: {
          select: {
            id: true,
            customerConfirmed: true,
            confirmedAt: true,
            disputeStatus: true,
            disputedItems: true,
            resolutionNotes: true,
            refundAmount: true,
            resolvedAt: true,
          },
        },
      },
    },
  }) satisfies Prisma.ReceiptVerificationSelect;

const dateStamp = () =>
  new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');

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
  const parsed = parseReceiptExportFilters(searchParams);
  if (!parsed.value) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.errors }, { status: 400 });
  }

  const filters = parsed.value;
  const where = buildReceiptExportWhere(filters);

  if (filters.format === 'json') {
    const select = buildSelect(filters.includeRaw);

    if (filters.cursor) {
      const rows = (await prisma.receiptVerification.findMany({
        where,
        select,
        orderBy: { id: 'asc' },
        cursor: { id: filters.cursor },
        skip: 1,
        take: filters.take + 1,
      })) as unknown as ReceiptExportRecord[];

      const hasMore = rows.length > filters.take;
      const pageRows = hasMore ? rows.slice(0, filters.take) : rows;
      const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null;
      const payload = pageRows.map((row) =>
        buildJsonReceiptExportRecord(row, {
          includeRaw: filters.includeRaw,
          includeHash: filters.includeHash,
          nested: filters.nested,
        })
      );

      return NextResponse.json(payload, {
        headers: nextCursor ? { 'x-next-cursor': nextCursor } : undefined,
      });
    }

    const rows = (await prisma.receiptVerification.findMany({
      where,
      select,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filters.limit,
    })) as unknown as ReceiptExportRecord[];

    const payload = rows.map((row) =>
      buildJsonReceiptExportRecord(row, {
        includeRaw: filters.includeRaw,
        includeHash: filters.includeHash,
        nested: filters.nested,
      })
    );

    return NextResponse.json(payload);
  }

  const csvHeaders = getReceiptExportCsvHeaders(filters.includeHash);
  const select = buildSelect(false);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`${toCsvLine(csvHeaders)}\n`));

        let cursor: string | null = null;
        let exported = 0;

        while (exported < filters.limit) {
          const take = Math.min(CSV_BATCH_SIZE, filters.limit - exported);
          const rows = (await prisma.receiptVerification.findMany({
            where,
            select,
            orderBy: { id: 'asc' },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            take,
          })) as unknown as ReceiptExportRecord[];

          if (rows.length === 0) break;

          for (const row of rows) {
            const flat = flattenReceiptExportRecord(row, { includeHash: filters.includeHash });
            const line = toCsvLine(csvHeaders.map((header) => flat[header]));
            controller.enqueue(encoder.encode(`${line}\n`));
          }

          exported += rows.length;
          cursor = rows[rows.length - 1]?.id ?? null;
          if (rows.length < take) break;
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="receipts_export_${dateStamp()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
