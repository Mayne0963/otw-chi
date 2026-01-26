import { describe, expect, it } from 'vitest';
import { calculateServiceMiles } from './service-miles';
import { ServiceType } from '@prisma/client';

describe('calculateServiceMiles', () => {
  it('calculates base miles from travel minutes', () => {
    const out = calculateServiceMiles({
      travelMinutes: 11,
      serviceType: ServiceType.FOOD,
      scheduledStart: new Date('2026-02-10T12:00:00.000Z'),
      quotedAt: new Date('2026-02-10T11:00:00.000Z'),
    });

    expect(out.serviceMilesBase).toBe(3);
    expect(out.serviceMilesFinal).toBeGreaterThanOrEqual(1);
  });

  it('adds wait time miles', () => {
    const out = calculateServiceMiles({
      travelMinutes: 10,
      waitMinutes: 9,
      serviceType: ServiceType.STORE,
      scheduledStart: new Date('2026-02-10T12:00:00.000Z'),
      quotedAt: new Date('2026-02-10T11:00:00.000Z'),
    });

    expect(out.quoteBreakdown.adders.waitTime).toBe(2);
  });

  it('adds multi-stop miles', () => {
    const out = calculateServiceMiles({
      travelMinutes: 10,
      numberOfStops: 3,
      serviceType: ServiceType.CONCIERGE,
      scheduledStart: new Date('2026-02-10T12:00:00.000Z'),
      quotedAt: new Date('2026-02-10T11:00:00.000Z'),
    });

    expect(out.quoteBreakdown.adders.multiStop).toBe(8);
  });

  it('applies return/exchange and peak adders on fixed subtotal', () => {
    const out = calculateServiceMiles({
      travelMinutes: 10,
      waitMinutes: 5,
      numberOfStops: 2,
      returnOrExchange: true,
      peakHours: true,
      serviceType: ServiceType.FOOD,
      scheduledStart: new Date('2026-02-10T12:00:00.000Z'),
      quotedAt: new Date('2026-02-10T11:00:00.000Z'),
    });

    expect(out.quoteBreakdown.adders.returnExchange).toBeGreaterThanOrEqual(1);
    expect(out.quoteBreakdown.adders.peakHours).toBeGreaterThanOrEqual(1);
  });

  it('discounts for advance scheduling and respects max cap', () => {
    const out = calculateServiceMiles({
      travelMinutes: 60,
      serviceType: ServiceType.FOOD,
      scheduledStart: new Date('2026-02-13T12:00:00.000Z'),
      quotedAt: new Date('2026-02-10T12:00:00.000Z'),
      advanceDiscountMax: 2,
    });

    expect(out.quoteBreakdown.discount.hoursInAdvance).toBeGreaterThanOrEqual(72);
    expect(out.serviceMilesDiscount).toBeLessThanOrEqual(2);
  });
});

