import type { ServiceType } from '@prisma/client';

export const SERVICE_MILE_MINUTES = 5;

export const SERVICE_MILES_RULES = {
  multiStopMilesPerExtraStop: 4,
  cashHandlingMiles: 12,
  returnOrExchangePremiumRate: 0.3,
  peakHoursSurgeRate: 0.1,
  sitAndWaitWaitPremiumRate: 0.5,
  discounts: [
    { minHoursInAdvance: 72, percent: 0.2 },
    { minHoursInAdvance: 48, percent: 0.15 },
    { minHoursInAdvance: 24, percent: 0.1 },
  ],
} as const;

export interface ServiceMilesQuoteInput {
  travelMinutes: number;
  serviceType: ServiceType;
  scheduledStart: Date;
  quotedAt: Date;
  waitMinutes?: number;
  sitAndWait?: boolean;
  numberOfStops?: number;
  returnOrExchange?: boolean;
  cashHandling?: boolean;
  peakHours?: boolean;
  advanceDiscountMax?: number;
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
      sitAndWaitPremium: number;
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

export function calculateServiceMiles(input: ServiceMilesQuoteInput): ServiceMilesQuote {
  const {
    travelMinutes,
    waitMinutes = 0,
    sitAndWait = false,
    numberOfStops,
    returnOrExchange = false,
    cashHandling = false,
    peakHours = false,
    scheduledStart,
    quotedAt,
    advanceDiscountMax = 0,
  } = input;

  const estimatedMinutes = travelMinutes;

  const baseMiles = Math.max(
    1,
    Math.ceil(Math.max(0, estimatedMinutes) / SERVICE_MILE_MINUTES)
  );

  const waitAdder = Math.ceil(Math.max(0, waitMinutes) / SERVICE_MILE_MINUTES);
  const sitAndWaitPremiumAdder =
    sitAndWait && waitAdder > 0 ? Math.ceil(waitAdder * SERVICE_MILES_RULES.sitAndWaitWaitPremiumRate) : 0;

  const totalStops = Math.max(1, numberOfStops ?? 1);
  const extraStops = Math.max(0, totalStops - 1);
  const stopsAdder = extraStops * SERVICE_MILES_RULES.multiStopMilesPerExtraStop;

  const cashAdder = cashHandling ? SERVICE_MILES_RULES.cashHandlingMiles : 0;

  const fixedSubtotal = baseMiles + waitAdder + sitAndWaitPremiumAdder + stopsAdder + cashAdder;

  const returnAdder = returnOrExchange
    ? Math.ceil(fixedSubtotal * SERVICE_MILES_RULES.returnOrExchangePremiumRate)
    : 0;
  const peakAdder = peakHours ? Math.ceil(fixedSubtotal * SERVICE_MILES_RULES.peakHoursSurgeRate) : 0;

  const totalAdders =
    waitAdder + sitAndWaitPremiumAdder + stopsAdder + cashAdder + returnAdder + peakAdder;
  const subtotal = baseMiles + totalAdders;

  const diffMs = scheduledStart.getTime() - quotedAt.getTime();
  const hoursInAdvance = diffMs / (1000 * 60 * 60);

  let discountPercent = 0;
  for (const rule of SERVICE_MILES_RULES.discounts) {
    if (hoursInAdvance >= rule.minHoursInAdvance) {
      discountPercent = rule.percent;
      break;
    }
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
        sitAndWaitPremium: sitAndWaitPremiumAdder,
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
