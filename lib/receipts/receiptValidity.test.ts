import { describe, expect, it } from 'vitest';
import { evaluateVeryfiReceipt } from './receiptValidity';
import knownGoodFixture from '@/tests/fixtures/veryfi/known-good-taco-bell.json';
import screenshotFixture from '@/tests/fixtures/veryfi/screenshot-lcd.json';
import totalsMismatchFixture from '@/tests/fixtures/veryfi/totals-mismatch.json';
import fraudRedFixture from '@/tests/fixtures/veryfi/fraud-red.json';

describe('evaluateVeryfiReceipt', () => {
  it('approves known good Veryfi payload with high realness percent', () => {
    const out = evaluateVeryfiReceipt(knownGoodFixture);

    expect(out.decision).toBe('APPROVE');
    expect(out.percentReal).toBeGreaterThanOrEqual(80);
    expect(out.scores.authenticity).toBeGreaterThanOrEqual(0.8);
    expect(out.scores.extraction).toBeGreaterThanOrEqual(0.8);
    expect(out.scores.business).toBeGreaterThanOrEqual(0.7);
  });

  it('flags screenshot/lcd signals as review or reject', () => {
    const out = evaluateVeryfiReceipt(screenshotFixture);

    expect(out.decision).not.toBe('APPROVE');
    expect(out.reasons.some((reason) => /screenshot|lcd/i.test(reason))).toBe(true);
  });

  it('returns review when totals do not add up', () => {
    const out = evaluateVeryfiReceipt(totalsMismatchFixture);

    expect(out.decision).toBe('REVIEW');
    expect(out.reasons).toContain('Totals do not add up');
  });

  it('rejects red fraud responses', () => {
    const out = evaluateVeryfiReceipt(fraudRedFixture);

    expect(out.decision).toBe('REJECT');
    expect(out.reasonCodes).toContain('FRAUD_COLOR_RED');
  });
});
