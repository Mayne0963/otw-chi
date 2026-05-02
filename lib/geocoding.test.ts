import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchAddress, validateAddress } from './geocoding';

describe('geocoding validation fallbacks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not validate an unmatched specific street address as a featured location', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );

    await expect(searchAddress('3016 Ashcroft Drive, Fort Wayne Indiana 46806')).resolves.toEqual([]);
    await expect(validateAddress('3016 Ashcroft Drive, Fort Wayne Indiana 46806')).resolves.toBeNull();
  });

  it('still resolves exact featured place names', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );

    const result = await validateAddress('Parkview Field');

    expect(result?.placeName).toBe('Parkview Field');
    expect(result?.streetAddress).toBe('1301 Ewing St');
  });

  it('does not fall back to unrelated featured locations for weak multi-token matches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );

    await expect(searchAddress('Brewer Park')).resolves.toEqual([]);
  });
});
