import type { ServiceType } from '@prisma/client';

export interface ServiceMilesQuoteInput {
  travelMinutes: number;
  serviceType: ServiceType; // Included for completeness/logging, though not explicitly used in current math rules
  scheduledStart: Date;
  quotedAt: Date;
  waitMinutes?: number;
  numberOfStops?: number;
  returnOrExchange?: boolean;
  cashHandling?: boolean;
  peakHours?: boolean;
  advanceDiscountMax?: number; // From MembershipPlan
}

export interface ServiceMilesQuote {
  estimatedMinutes: number;
  serviceMilesBase: number;
  serviceMilesAdders: number;
  serviceMilesDiscount: number;
  serviceMilesFinal: number;
  quoteBreakdown: {
    baseMiles: number;
    adders: {
      waitTime: number;
      multiStop: number;
      returnExchange: number;
      cashHandling: number;
      peakHours: number;
    };
    discount: {
      hoursInAdvance: number;
      percentage: number;
      amount: number;
    };
    subtotal: number;
    final: number;
  };
}

/**
 * Calculates the Service Miles quote based on OTW business rules.
 * 
 * Rules:
 * - Base Miles: ceil(estimatedMinutes / 5)
 * - Adders:
 *   - Wait time: +1 mile per 5 min (ceil)
 *   - Multi-stop: +4 miles per extra stop
 *   - Cash handling: +12 miles
 *   - Return/Exchange: +25% (of base + fixed adders)
 *   - Peak hours: +10% (of base + fixed adders)
 * - Discount:
 *   - >= 24h: 10%
 *   - >= 48h: 15%
 *   - >= 72h: 20%
 *   - Capped by MembershipPlan.advanceDiscountMax
 */
export function calculateServiceMiles(input: ServiceMilesQuoteInput): ServiceMilesQuote {
  const {
    travelMinutes,
    waitMinutes = 0,
    numberOfStops,
    returnOrExchange = false,
    cashHandling = false,
    peakHours = false,
    scheduledStart,
    quotedAt,
    advanceDiscountMax = 0,
  } = input;

  const estimatedMinutes = travelMinutes;

  const baseMiles = Math.max(1, Math.ceil(Math.max(0, estimatedMinutes) / 5));

  const waitAdder = Math.ceil(Math.max(0, waitMinutes) / 5);

  const totalStops = Math.max(1, numberOfStops ?? 1);
  const extraStops = Math.max(0, totalStops - 1);
  const stopsAdder = extraStops * 4;

  const cashAdder = cashHandling ? 12 : 0;

  const fixedSubtotal = baseMiles + waitAdder + stopsAdder + cashAdder;

  const returnAdder = returnOrExchange ? Math.ceil(fixedSubtotal * 0.25) : 0;
  const peakAdder = peakHours ? Math.ceil(fixedSubtotal * 0.10) : 0;

  const totalAdders = waitAdder + stopsAdder + cashAdder + returnAdder + peakAdder;
  const subtotal = baseMiles + totalAdders;

  const diffMs = scheduledStart.getTime() - quotedAt.getTime();
  const hoursInAdvance = diffMs / (1000 * 60 * 60);

  let discountPercent = 0;
  if (hoursInAdvance >= 72) {
    discountPercent = 0.20;
  } else if (hoursInAdvance >= 48) {
    discountPercent = 0.15;
  } else if (hoursInAdvance >= 24) {
    discountPercent = 0.10;
  }

  let discountAmount = Math.floor(subtotal * discountPercent);

  if (advanceDiscountMax > 0 && discountAmount > advanceDiscountMax) {
    discountAmount = advanceDiscountMax;
  }

  let finalMiles = subtotal - discountAmount;

  if (finalMiles < 1) {
    finalMiles = 1;
  }

  return {
    estimatedMinutes,
    serviceMilesBase: baseMiles,
    serviceMilesAdders: totalAdders,
    serviceMilesDiscount: discountAmount,
    serviceMilesFinal: finalMiles,
    quoteBreakdown: {
      baseMiles,
      adders: {
        waitTime: waitAdder,
        multiStop: stopsAdder,
        returnExchange: returnAdder,
        cashHandling: cashAdder,
        peakHours: peakAdder,
      },
      discount: {
        hoursInAdvance,
        percentage: discountPercent,
        amount: discountAmount,
      },
      subtotal,
      final: finalMiles,
    },
  };
}
