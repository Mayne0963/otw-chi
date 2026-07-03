import { describe, expect, it } from 'vitest';
import {
  buildRequestRouteSnapshot,
  calculateRequestRouteMiles,
  getChargeableStopCount,
  getRequestRouteSnapshot,
  getRequestRouteStops,
} from './request-stops';

describe('request stop helpers', () => {
  it('builds and reads a stored route snapshot with waypoints', () => {
    const snapshot = buildRequestRouteSnapshot({
      pickup: {
        address: '1301 Ewing St, Fort Wayne, IN 46802',
        lat: 41.0676,
        lng: -85.1402,
        label: 'Parkview Field',
      },
      intermediateStops: [
        {
          address: '202 W Superior St, Fort Wayne, IN 46802',
          lat: 41.0818,
          lng: -85.1438,
          label: 'Promenade Park',
        },
      ],
      dropoff: {
        address: '4130 W Jefferson Blvd, Fort Wayne, IN 46804',
        lat: 41.072,
        lng: -85.1954,
        label: 'Jefferson Pointe',
      },
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.stops).toHaveLength(3);
    expect(getChargeableStopCount(snapshot?.stops.length ?? 0)).toBe(2);

    const parsed = getRequestRouteSnapshot({ routeStops: snapshot });
    expect(parsed).toEqual(snapshot);

    const displayStops = getRequestRouteStops({ routeStops: snapshot });
    expect(displayStops.map((stop) => stop.type)).toEqual(['pickup', 'waypoint', 'dropoff']);
  });

  it('falls back to the request pickup and dropoff when no snapshot exists', () => {
    expect(
      getRequestRouteStops(null, {
        pickupAddress: 'Pickup address',
        dropoffAddress: 'Dropoff address',
      }),
    ).toEqual([
      { type: 'pickup', address: 'Pickup address' },
      { type: 'dropoff', address: 'Dropoff address' },
    ]);
  });

  it('sums route miles across all legs', () => {
    const directMiles = calculateRequestRouteMiles([
      { lat: 41.0676, lng: -85.1402 },
      { lat: 41.072, lng: -85.1954 },
    ]);

    const multiStopMiles = calculateRequestRouteMiles([
      { lat: 41.0676, lng: -85.1402 },
      { lat: 41.0818, lng: -85.1438 },
      { lat: 41.072, lng: -85.1954 },
    ]);

    expect(directMiles).toBeGreaterThan(0);
    expect(multiStopMiles).toBeGreaterThan(directMiles);
  });
});
