import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateDistanceMiles, searchAddress, validateAddress } from './geocoding';

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

    const results = await searchAddress('Brewer Park');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.placeName?.toLowerCase().includes('park'))).toBe(true);
  });

  it('still returns default featured suggestions for short unmatched queries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );

    const results = await searchAddress('Til');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.placeName).toBe('Parkview Field');
  });

  it('calculates pickup-to-dropoff distance in miles', () => {
    expect(calculateDistanceMiles(41.0793, -85.1394, 41.0676, -85.1402)).toBeGreaterThan(0);
    expect(calculateDistanceMiles(41.0793, -85.1394, 41.0793, -85.1394)).toBe(0);
  });
});
