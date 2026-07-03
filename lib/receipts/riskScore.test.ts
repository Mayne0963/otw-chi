import { describe, expect, it } from 'vitest';
import { scoreReceiptRisk } from './riskScore';

const NOW = new Date('2026-02-20T12:00:00.000Z');

describe('scoreReceiptRisk', () => {
  it('returns rejected with 0 score for duplicate receipts', () => {
    const out = scoreReceiptRisk({
      isDuplicate: true,
      now: NOW,
    });

    expect(out.riskScore).toBe(0);
    expect(out.status).toBe('REJECTED');
    expect(out.reasonCodes).toEqual(['DUPLICATE_RECEIPT']);
  });

  it('approves clean receipts with strong match and complete fields', () => {
    const out = scoreReceiptRisk({
      expectedVendor: "Broski's Kitchen",
      merchantName: "Broski's Kitchen #104",
      expectedTotal: '42.00',
      subtotal: '36.00',
      tax: '3.00',
      tip: '3.00',
      total: '42.00',
      receiptDate: new Date('2026-02-20T10:30:00.000Z'),
      currency: 'USD',
      confidenceScore: 0.95,
      now: NOW,
    });

    expect(out.status).toBe('APPROVED');
    expect(out.riskScore).toBeGreaterThanOrEqual(80);
    expect(out.reasonCodes).toEqual([]);
  });

  it('rejects when total is missing', () => {
    const out = scoreReceiptRisk({
      expectedVendor: 'Broski Kitchen',
      merchantName: 'Broski Kitchen',
      expectedTotal: '42.00',
      subtotal: '36.00',
      tax: '3.00',
      tip: '3.00',
      total: null,
      receiptDate: new Date('2026-02-20T10:30:00.000Z'),
      currency: 'USD',
      confidenceScore: 90,
      now: NOW,
    });

    expect(out.status).toBe('REJECTED');
    expect(out.reasonCodes).toContain('TOTAL_NOT_FOUND');
  });

  it('flags merchant mismatch when names do not align', () => {
    const out = scoreReceiptRisk({
      expectedVendor: 'Broski Kitchen',
      merchantName: 'Completely Different Cafe',
      expectedTotal: '42.00',
      subtotal: '36.00',
      tax: '3.00',
      tip: '3.00',
      total: '42.00',
      receiptDate: new Date('2026-02-20T10:30:00.000Z'),
      currency: 'USD',
      confidenceScore: 92,
      now: NOW,
    });

    expect(out.status).toBe('FLAGGED');
    expect(out.reasonCodes).toContain('MERCHANT_MISMATCH');
  });

  it('rejects stale receipts older than 24 hours', () => {
    const out = scoreReceiptRisk({
      expectedVendor: 'Broski Kitchen',
      merchantName: 'Broski Kitchen',
      expectedTotal: '42.00',
      subtotal: '36.00',
      tax: '3.00',
      tip: '3.00',
      total: '42.00',
      receiptDate: new Date('2026-02-18T09:00:00.000Z'),
      currency: 'USD',
      confidenceScore: 90,
      now: NOW,
    });

    expect(out.status).toBe('REJECTED');
    expect(out.reasonCodes).toContain('STALE_RECEIPT');
  });

  it('applies large and percent mismatch penalties for large orders', () => {
    const out = scoreReceiptRisk({
      expectedVendor: 'Broski Kitchen',
      merchantName: 'Broski Kitchen',
      expectedTotal: '100.00',
      subtotal: '90.00',
      tax: '5.00',
      tip: '20.00',
      total: '115.00',
      receiptDate: new Date('2026-02-20T10:30:00.000Z'),
      currency: 'USD',
      confidenceScore: 90,
      now: NOW,
    });

    expect(out.reasonCodes).toContain('TOTAL_LARGE_MISMATCH');
    expect(out.reasonCodes).toContain('TOTAL_PERCENT_MISMATCH');
    expect(out.status).toBe('REJECTED');
  });
});
