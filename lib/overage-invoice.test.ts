import { describe, expect, it } from 'vitest';
import { getPeriodKey, getPreviousPeriodKey } from './overage-period';

describe('overage invoice period helpers', () => {
  it('computes period key in America/Chicago around month boundary', () => {
    const date = new Date('2026-03-01T05:30:00.000Z');
    expect(getPeriodKey(date, 'America/Chicago')).toBe('2026-02');
  });

  it('computes previous period key', () => {
    const date = new Date('2026-03-15T12:00:00.000Z');
    expect(getPreviousPeriodKey(date, 'America/Chicago')).toBe('2026-02');
  });
});
