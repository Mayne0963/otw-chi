import { describe, expect, it } from 'vitest';
import {
  buildReceiptExportWhere,
  getReceiptExportCsvHeaders,
  parseReceiptExportFilters,
} from '@/lib/admin/receiptsExport';

describe('receipts export helpers', () => {
  it('builds CSV headers with optional image hash column', () => {
    const base = getReceiptExportCsvHeaders(false);
    const withHash = getReceiptExportCsvHeaders(true);

    expect(base.includes('imageHash')).toBe(false);
    expect(withHash[withHash.length - 1]).toBe('imageHash');
  });

  it('parses basic filters and applies defaults', () => {
    const now = new Date('2026-02-20T12:00:00.000Z');
    const query = new URLSearchParams('format=csv&status=APPROVED,FLAGGED&minRisk=60&vendor=broski');
    const parsed = parseReceiptExportFilters(query, now);

    expect(parsed.errors).toEqual([]);
    expect(parsed.value).not.toBeNull();
    expect(parsed.value?.format).toBe('csv');
    expect(parsed.value?.statuses).toEqual(['APPROVED', 'FLAGGED']);
    expect(parsed.value?.minRisk).toBe(60);
  });

  it('builds Prisma where filters for status, risk, vendor, and ids', () => {
    const now = new Date('2026-02-20T12:00:00.000Z');
    const query = new URLSearchParams(
      'status=FLAGGED&minRisk=50&maxRisk=90&vendor=broski&userId=u_1&deliveryRequestId=dr_1&start=2026-01-01&end=2026-01-31'
    );
    const parsed = parseReceiptExportFilters(query, now);
    expect(parsed.value).not.toBeNull();

    const where = buildReceiptExportWhere(parsed.value!);

    expect(where.status).toEqual({ in: ['FLAGGED'] });
    expect(where.riskScore).toEqual({ gte: 50, lte: 90 });
    expect(where.userId).toBe('u_1');
    expect(where.deliveryRequestId).toBe('dr_1');
    expect(where.OR).toBeDefined();
    expect(where.createdAt).toEqual({
      gte: new Date('2026-01-01T00:00:00.000Z'),
      lte: new Date('2026-01-31T23:59:59.999Z'),
    });
  });
});
