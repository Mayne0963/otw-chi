import { ServiceType } from './otw/otwTypes';

export interface ServiceMilesQuoteInput {
  estimatedMinutes: number;
  serviceType: ServiceType; // Included for completeness/logging, though not explicitly used in current math rules
  scheduledStart: Date;
  waitMinutes?: number;
  numberOfStops?: number; // Number of EXTRA stops
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
    estimatedMinutes,
    waitMinutes = 0,
    numberOfStops = 0,
    returnOrExchange = false,
    cashHandling = false,
    peakHours = false,
    scheduledStart,
    advanceDiscountMax = 0,
  } = input;

  // 1. Base Miles
  // baseMiles = ceil(estimatedMinutes / 5)
  const baseMiles = Math.ceil(Math.max(0, estimatedMinutes) / 5);

  // 2. Fixed Adders
  // Wait time: +1 mile per 5 min
  const waitAdder = Math.ceil(Math.max(0, waitMinutes) / 5);

  // Multi-stop: +4 miles per extra stop
  const stopsAdder = Math.max(0, numberOfStops) * 4;

  // Cash handling: +12 miles
  const cashAdder = cashHandling ? 12 : 0;

  const fixedSubtotal = baseMiles + waitAdder + stopsAdder + cashAdder;

  // 3. Percentage Adders (Return/Exchange, Peak Hours)
  // Applied to the fixed subtotal to capture the full scope of the job's complexity
  const returnAdder = returnOrExchange ? Math.ceil(fixedSubtotal * 0.25) : 0;
  const peakAdder = peakHours ? Math.ceil(fixedSubtotal * 0.10) : 0;

  const totalAdders = waitAdder + stopsAdder + cashAdder + returnAdder + peakAdder;
  const subtotal = baseMiles + totalAdders;

  // 4. Advance Booking Discount
  // ≥24h → 10%, ≥48h → 15%, ≥72h → 20%
  const now = new Date();
  const diffMs = scheduledStart.getTime() - now.getTime();
  const hoursInAdvance = diffMs / (1000 * 60 * 60);

  let discountPercent = 0;
  if (hoursInAdvance >= 72) {
    discountPercent = 0.20;
  } else if (hoursInAdvance >= 48) {
    discountPercent = 0.15;
  } else if (hoursInAdvance >= 24) {
    discountPercent = 0.10;
  }

  // Calculate discount amount
  let discountAmount = Math.floor(subtotal * discountPercent);

  // Cap discount by advanceDiscountMax
  if (advanceDiscountMax > 0 && discountAmount > advanceDiscountMax) {
    discountAmount = advanceDiscountMax;
  }

  // 5. Final Calculation
  let finalMiles = subtotal - discountAmount;

  // Constraint: Never return 0 miles (unless input was 0 and no adders, but "Minimum 1" is safer)
  // Assuming a valid job always costs at least 1 mile if there's any duration.
  // If estimatedMinutes is 0, base is 0.
  // Let's enforce min 1 mile if base + adders > 0, or just always min 1 for a valid quote?
  // "Never return 0 miles"
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
