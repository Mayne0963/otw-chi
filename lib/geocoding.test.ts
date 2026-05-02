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

  it('suggests Brewer Park in Fort Wayne when searching by name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              lat: '42.3830734',
              lon: '-82.9866898',
              display_name: 'Brewer Park, 4535, Detroit, Wayne County, Michigan, 48214, United States',
              address: {
                city: 'Detroit',
                state: 'Michigan',
                postcode: '48214',
              },
              namedetails: { name: 'Brewer Park' },
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    const results = await searchAddress('Brewer Park, Fort Wayne');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.placeName).toBe('Brewer Park');
    expect(results[0]?.streetAddress).toContain('800');
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

  it('strips suite/unit/apt details so Fort Wayne addresses still resolve', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL(input.url);

      const q = url.searchParams.get('q') ?? '';
      if (/\\b(apt|apartment|unit|suite|ste|#)\\b/i.test(q)) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      return new Response(
        JSON.stringify([
          {
            lat: '41.070677',
            lon: '-85.010725',
            display_name:
              '3016, Ashcroft Drive, Anthony Wayne Village, Fort Wayne, Allen County, Indiana, 46806, United States',
            address: {
              house_number: '3016',
              road: 'Ashcroft Drive',
              city: 'Fort Wayne',
              state: 'Indiana',
              postcode: '46806',
            },
          },
        ]),
        { status: 200 },
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const results = await searchAddress('3016 Ashcroft Dr, Fort Wayne, IN 46806 Apt 3');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.streetAddress).toContain('3016');

    const calledQs = fetchMock.mock.calls
      .map(([input]) => {
        const url =
          typeof input === 'string'
            ? new URL(input)
            : input instanceof URL
              ? input
              : new URL((input as Request).url);
        return url.searchParams.get('q') ?? '';
      })
      .join(' | ');

    expect(calledQs.toLowerCase()).not.toContain(' apt ');
    expect(calledQs.toLowerCase()).not.toContain(' suite ');
    expect(calledQs.toLowerCase()).not.toContain(' unit ');
  });

  it('ranks featured suggestions by closest textual match first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );

    const results = await searchAddress('Wayne High School');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.placeName).toBe('Wayne High School');

    const sniderIndex = results.findIndex((result) => result.placeName === 'R. Nelson Snider High School');
    if (sniderIndex !== -1) {
      expect(sniderIndex).toBeGreaterThan(0);
    }
  });

  it('adds Fort Wayne, IN bias even when query already contains Fort Wayne', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL((input as Request).url);

      const q = (url.searchParams.get('q') ?? '').toLowerCase();

      if (q === 'southwest fort wayne') {
        return new Response(
          JSON.stringify([
            {
              lat: '42.2976812',
              lon: '-83.0986713',
              display_name: 'Fort Wayne, 6053, Southwest Detroit, Detroit, Wayne County, Michigan, United States',
              address: {
                city: 'Detroit',
                state: 'Michigan',
                postcode: '48209',
              },
              namedetails: { name: 'Fort Wayne' },
            },
          ]),
          { status: 200 },
        );
      }

      if (q.includes('southwest fort wayne') && q.includes('fort wayne, in')) {
        return new Response(
          JSON.stringify([
            {
              lat: '41.0727241',
              lon: '-85.2499968',
              display_name:
                'Parkview Southwest, Glencarin Boulevard, Fort Wayne, Allen County, Indiana, 46804, United States',
              address: {
                road: 'Glencarin Boulevard',
                city: 'Fort Wayne',
                state: 'Indiana',
                postcode: '46804',
              },
              namedetails: { name: 'Parkview Southwest' },
            },
          ]),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify([]), { status: 200 });
    });

    vi.stubGlobal('fetch', fetchMock);

    const results = await searchAddress('Southwest Fort Wayne');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.formattedAddress.toLowerCase()).toContain('fort wayne');

    const calledQueries = fetchMock.mock.calls
      .map(([input]) => {
        const url =
          typeof input === 'string'
            ? new URL(input)
            : input instanceof URL
              ? input
              : new URL((input as Request).url);
        return (url.searchParams.get('q') ?? '').toLowerCase();
      });

    expect(calledQueries.some((q) => q.includes('fort wayne, in'))).toBe(true);
  });

  it('suggests south Fort Wayne places like Villa Capri Apartments', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );

    const results = await searchAddress('Villa Capr');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.placeName).toBe('Villa Capri Apartments');
    expect(results[0]?.streetAddress).toBe('2015 Fox Point Trl');
    expect(results[0]?.zipCode).toBe('46816');
  });

  it('calculates pickup-to-dropoff distance in miles', () => {
    expect(calculateDistanceMiles(41.0793, -85.1394, 41.0676, -85.1402)).toBeGreaterThan(0);
    expect(calculateDistanceMiles(41.0793, -85.1394, 41.0793, -85.1394)).toBe(0);
  });
});
