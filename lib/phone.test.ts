import { describe, expect, it } from 'vitest';
import { countPhoneDigits, formatPhoneNumber, normalizeOptionalPhone } from '@/lib/phone';

describe('phone helpers', () => {
  it('formats local phone numbers as the user types', () => {
    expect(formatPhoneNumber('2605550123')).toBe('(260) 555-0123');
    expect(formatPhoneNumber('2605550')).toBe('(260) 555-0');
  });

  it('strips letters and preserves a leading US country code', () => {
    expect(formatPhoneNumber('1-260-555-0123')).toBe('1 (260) 555-0123');
    expect(formatPhoneNumber('260-abc-0123')).toBe('(260) 012-3');
  });

  it('normalizes optional phone values for storage', () => {
    expect(normalizeOptionalPhone('(260) 555-0123')).toBe('(260) 555-0123');
    expect(normalizeOptionalPhone('')).toBeNull();
    expect(countPhoneDigits('1 (260) 555-0123')).toBe(11);
  });
});
