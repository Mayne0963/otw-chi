export const RECEIPT_REASON_CODES = [
  'DUPLICATE_RECEIPT',
  'TOTAL_NOT_FOUND',
  'INVALID_TOTAL',
  'DATE_MISSING',
  'FUTURE_DATE',
  'STALE_RECEIPT',
  'MERCHANT_MISSING',
  'MERCHANT_MISMATCH',
  'MERCHANT_WEAK_MATCH',
  'TOTAL_SMALL_MISMATCH',
  'TOTAL_MISMATCH',
  'TOTAL_LARGE_MISMATCH',
  'TOTAL_PERCENT_MISMATCH',
  'SUBTOTAL_MISSING',
  'TAX_MISSING',
  'TIP_MISSING',
  'CURRENCY_MISSING',
  'LOW_CONFIDENCE',
  'VERY_LOW_CONFIDENCE',
  'TOTAL_MATH_MISMATCH',
  'VERYFI_ERROR',
] as const;

export type ReceiptReasonCode = (typeof RECEIPT_REASON_CODES)[number];
export type ReceiptDecisionStatus = 'APPROVED' | 'FLAGGED' | 'REJECTED' | 'PENDING';

type MoneyInput = number | string | null | undefined;

export type ReceiptRiskInput = {
  deliveryRequestId?: string;
  currentUserId?: string;
  expectedVendor?: string | null;
  expectedTotal?: MoneyInput;
  merchantName?: string | null;
  subtotal?: MoneyInput;
  tax?: MoneyInput;
  tip?: MoneyInput;
  total?: MoneyInput;
  receiptDate?: Date | string | null;
  currency?: string | null;
  confidenceScore?: number | null;
  imageHash?: string | null;
  isDuplicate?: boolean;
  veryfiError?: boolean;
  now?: Date;
};

export type RiskPenalty = {
  code: ReceiptReasonCode;
  delta: number;
};

export type ReceiptRiskBreakdown = {
  base: 100;
  penalties: RiskPenalty[];
  fuzzyScore: number | null;
  diff: string | null;
  expectedTotal: string | null;
  extractedTotal: string | null;
};

export type ReceiptRiskDecision = {
  riskScore: number;
  status: ReceiptDecisionStatus;
  reasonCodes: ReceiptReasonCode[];
  riskBreakdown: ReceiptRiskBreakdown;
  normalizedConfidence: number | null;
};

const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;
const STALE_WINDOW_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseMoneyToCents(value: MoneyInput): number | null {
  if (value == null) return null;
  const rawValue = typeof value === 'number' ? `${value}` : value.trim();
  if (!rawValue) return null;

  const sanitized = rawValue.replace(/[$,\s]/g, '');
  if (!sanitized) return null;

  let normalized = sanitized;
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized) && /^-?\d+(?:\.\d+)?e[+-]?\d+$/i.test(normalized)) {
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return null;
    normalized = numeric.toFixed(12).replace(/\.?0+$/, '');
  }

  const match = normalized.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!match) return null;

  const negative = Boolean(match[1]);
  const whole = Number(match[2]);
  if (!Number.isFinite(whole)) return null;

  const fractional = match[3] ?? '';
  const centsPart = fractional.padEnd(2, '0').slice(0, 2);
  const roundingDigit = fractional.length > 2 ? Number(fractional[2]) : 0;

  let cents = whole * 100 + Number(centsPart || '0');
  if (roundingDigit >= 5) cents += 1;
  return negative ? -cents : cents;
}

function formatCents(cents: number | null): string | null {
  if (cents == null) return null;
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '-' : '';
  const whole = Math.floor(abs / 100);
  const frac = `${abs % 100}`.padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

function buildBigramMultiset(input: string): Map<string, number> {
  const map = new Map<string, number>();
  if (input.length < 2) return map;

  for (let i = 0; i < input.length - 1; i += 1) {
    const pair = input.slice(i, i + 2);
    map.set(pair, (map.get(pair) ?? 0) + 1);
  }
  return map;
}

function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const aPairs = buildBigramMultiset(a);
  const bPairs = buildBigramMultiset(b);

  let intersection = 0;
  for (const [pair, count] of aPairs.entries()) {
    const other = bPairs.get(pair);
    if (other) {
      intersection += Math.min(count, other);
    }
  }

  const totalPairs = (a.length - 1) + (b.length - 1);
  return totalPairs === 0 ? 0 : (2 * intersection) / totalPairs;
}

function tokenJaccard(a: string, b: string): number {
  const aTokens = new Set(a.split(/\s+/).filter(Boolean));
  const bTokens = new Set(b.split(/\s+/).filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function normalizeMerchantName(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/\bstore\s*#?\s*\d+\b/g, ' ')
    .replace(/#\s*\d+\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fuzzyMatchScore(a: string | null | undefined, b: string | null | undefined): number {
  const normalizedA = normalizeMerchantName(a);
  const normalizedB = normalizeMerchantName(b);
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;

  const dice = diceCoefficient(normalizedA, normalizedB);
  const jaccard = tokenJaccard(normalizedA, normalizedB);
  return clamp((dice * 0.6) + (jaccard * 0.4), 0, 1);
}

export function moneyDiff(a: MoneyInput, b: MoneyInput): number | null {
  const aCents = parseMoneyToCents(a);
  const bCents = parseMoneyToCents(b);
  if (aCents == null || bCents == null) return null;
  return Math.abs(aCents - bCents);
}

export function normalizeConfidence(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  if (raw >= 0 && raw <= 1) return raw * 100;
  if (raw >= 0 && raw <= 100) return raw;
  return null;
}

export function scoreReceiptRisk(input: ReceiptRiskInput): ReceiptRiskDecision {
  if (input.isDuplicate) {
    return {
      riskScore: 0,
      status: 'REJECTED',
      reasonCodes: ['DUPLICATE_RECEIPT'],
      riskBreakdown: {
        base: 100,
        penalties: [{ code: 'DUPLICATE_RECEIPT', delta: -100 }],
        fuzzyScore: null,
        diff: null,
        expectedTotal: null,
        extractedTotal: null,
      },
      normalizedConfidence: normalizeConfidence(input.confidenceScore),
    };
  }

  if (input.veryfiError) {
    return {
      riskScore: 0,
      status: 'PENDING',
      reasonCodes: ['VERYFI_ERROR'],
      riskBreakdown: {
        base: 100,
        penalties: [{ code: 'VERYFI_ERROR', delta: -100 }],
        fuzzyScore: null,
        diff: null,
        expectedTotal: null,
        extractedTotal: null,
      },
      normalizedConfidence: null,
    };
  }

  const penalties: RiskPenalty[] = [];
  const reasonCodes: ReceiptReasonCode[] = [];
  const addPenalty = (code: ReceiptReasonCode, delta: number) => {
    penalties.push({ code, delta });
    if (!reasonCodes.includes(code)) reasonCodes.push(code);
  };

  const now = input.now ?? new Date();
  const normalizedConfidence = normalizeConfidence(input.confidenceScore);

  const expectedTotalCents = parseMoneyToCents(input.expectedTotal);
  const totalCents = parseMoneyToCents(input.total);
  const subtotalCents = parseMoneyToCents(input.subtotal);
  const taxCents = parseMoneyToCents(input.tax);
  const tipCents = parseMoneyToCents(input.tip);
  const receiptDate = parseDate(input.receiptDate);

  let fuzzyScore: number | null = null;

  if (totalCents == null) {
    addPenalty('TOTAL_NOT_FOUND', -60);
  } else if (totalCents <= 0) {
    addPenalty('INVALID_TOTAL', -70);
  }

  if (!receiptDate) {
    addPenalty('DATE_MISSING', -15);
  } else {
    if (receiptDate.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS) {
      addPenalty('FUTURE_DATE', -25);
    }
    if (receiptDate.getTime() < now.getTime() - STALE_WINDOW_MS) {
      addPenalty('STALE_RECEIPT', -60);
    }
  }

  const expectedVendor = (input.expectedVendor ?? '').trim();
  const merchantName = (input.merchantName ?? '').trim();
  if (expectedVendor) {
    if (!merchantName) {
      addPenalty('MERCHANT_MISSING', -20);
    } else {
      fuzzyScore = fuzzyMatchScore(merchantName, expectedVendor);
      if (fuzzyScore < 0.55) {
        addPenalty('MERCHANT_MISMATCH', -35);
      } else if (fuzzyScore < 0.75) {
        addPenalty('MERCHANT_WEAK_MATCH', -15);
      }
    }
  }

  let diffCents: number | null = null;
  if (expectedTotalCents != null && totalCents != null) {
    diffCents = Math.abs(totalCents - expectedTotalCents);
    const diffDollars = diffCents / 100;

    if (diffDollars > 2 && diffDollars <= 5) {
      addPenalty('TOTAL_SMALL_MISMATCH', -10);
    } else if (diffDollars > 5 && diffDollars <= 10) {
      addPenalty('TOTAL_MISMATCH', -25);
    } else if (diffDollars > 10) {
      addPenalty('TOTAL_LARGE_MISMATCH', -45);
    }

    const expectedDollars = expectedTotalCents / 100;
    if (expectedDollars >= 50 && expectedDollars > 0) {
      const diffPercent = diffDollars / expectedDollars;
      if (diffPercent > 0.1) {
        addPenalty('TOTAL_PERCENT_MISMATCH', -15);
      }
    }
  }

  if (subtotalCents == null) addPenalty('SUBTOTAL_MISSING', -5);
  if (taxCents == null) addPenalty('TAX_MISSING', -5);
  if (tipCents == null) addPenalty('TIP_MISSING', -3);
  if (!input.currency || !input.currency.trim()) addPenalty('CURRENCY_MISSING', -5);

  if (normalizedConfidence != null && normalizedConfidence < 50) {
    addPenalty('LOW_CONFIDENCE', -20);
  }
  if (normalizedConfidence != null && normalizedConfidence < 30) {
    addPenalty('VERY_LOW_CONFIDENCE', -35);
  }

  if (subtotalCents != null && taxCents != null && tipCents != null && totalCents != null) {
    const mathDiff = Math.abs((subtotalCents + taxCents + tipCents) - totalCents);
    if (mathDiff > 100) {
      addPenalty('TOTAL_MATH_MISMATCH', -15);
    }
  }

  const totalPenalty = penalties.reduce((sum, item) => sum + item.delta, 0);
  const riskScore = clamp(Math.round(100 + totalPenalty), 0, 100);

  const hardRejectReasons: ReceiptReasonCode[] = [
    'DUPLICATE_RECEIPT',
    'INVALID_TOTAL',
    'TOTAL_NOT_FOUND',
    'STALE_RECEIPT',
  ];

  const hardRejected = reasonCodes.some((reason) => hardRejectReasons.includes(reason));

  let status: ReceiptDecisionStatus;
  if (hardRejected) {
    status = 'REJECTED';
  } else if (riskScore >= 80) {
    status = 'APPROVED';
  } else if (riskScore >= 50) {
    status = 'FLAGGED';
  } else {
    status = 'REJECTED';
  }

  return {
    riskScore,
    status,
    reasonCodes,
    riskBreakdown: {
      base: 100,
      penalties,
      fuzzyScore,
      diff: formatCents(diffCents),
      expectedTotal: formatCents(expectedTotalCents),
      extractedTotal: formatCents(totalCents),
    },
    normalizedConfidence,
  };
}
