export type ReceiptDecision = 'APPROVE' | 'REVIEW' | 'REJECT';

export type ReceiptValidityScores = {
  authenticity: number;
  extraction: number;
  business: number;
};

export type VeryfiReceiptEvaluation = {
  decision: ReceiptDecision;
  percentReal: number;
  scores: ReceiptValidityScores;
  reasons: string[];
  reasonCodes: string[];
  meta: {
    fraudScore: number | null;
    fraudColor: string | null;
    fraudTypes: string[];
    ocrScore: number | null;
    blurry: boolean;
  };
};

type UnknownRecord = Record<string, unknown>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function extractValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value?: unknown }).value ?? null;
  }
  return value;
}

function extractString(value: unknown): string | null {
  const raw = extractValue(value);
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

function extractNumber(value: unknown): number | null {
  const raw = extractValue(value);
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const normalized = raw.replace(/[^0-9.-]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeUnitInterval(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return value;
  if (value > 1 && value <= 100) return value / 100;
  return null;
}

function normalizeType(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeFraudTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return normalizeType(item);
      if (item && typeof item === 'object') {
        const record = item as UnknownRecord;
        const candidate = extractString(record.type) ?? extractString(record.name) ?? extractString(record.value);
        return candidate ? normalizeType(candidate) : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function collectConfidenceCandidates(value: unknown, depth = 0): number[] {
  if (depth > 5 || !value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectConfidenceCandidates(item, depth + 1));
  }
  if (typeof value !== 'object') return [];

  const out: number[] = [];
  const record = value as UnknownRecord;
  for (const [key, nested] of Object.entries(record)) {
    if (key.toLowerCase().includes('fraud')) {
      continue;
    }

    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('confidence') || lowerKey.includes('ocr_score')) {
      const normalized = normalizeUnitInterval(extractNumber(nested));
      if (normalized != null) out.push(normalized);
    }

    out.push(...collectConfidenceCandidates(nested, depth + 1));
  }

  return out;
}

function hasBlurrySignal(payload: UnknownRecord): boolean {
  const meta = (payload.meta ?? {}) as UnknownRecord;
  const pages = Array.isArray(meta.pages) ? meta.pages : [];
  const pageBlur = pages.some((page) => {
    if (!page || typeof page !== 'object') return false;
    const value = extractValue((page as UnknownRecord).is_blurry);
    return value === true;
  });

  const imgBlur = extractValue(payload.img_blur) === true;
  const isBlurryList = Array.isArray(payload.is_blurry) ? payload.is_blurry : [];
  const listBlur = isBlurryList.some((entry) => extractValue(entry) === true);

  return pageBlur || imgBlur || listBlur;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function mapDecisionToReceiptStatus(decision: ReceiptDecision): 'APPROVED' | 'FLAGGED' | 'REJECTED' {
  if (decision === 'APPROVE') return 'APPROVED';
  if (decision === 'REVIEW') return 'FLAGGED';
  return 'REJECTED';
}

export function evaluateVeryfiReceipt(payload: unknown): VeryfiReceiptEvaluation {
  const record = (payload && typeof payload === 'object' ? payload : {}) as UnknownRecord;
  const meta = (record.meta && typeof record.meta === 'object' ? record.meta : {}) as UnknownRecord;
  const fraud = (meta.fraud && typeof meta.fraud === 'object' ? meta.fraud : {}) as UnknownRecord;
  const fraudColor = extractString(fraud.color)?.toLowerCase() ?? null;
  const fraudScore = normalizeUnitInterval(extractNumber(fraud.score));
  const fraudTypes = normalizeFraudTypes(fraud.types);

  const reasons: string[] = [];
  const reasonCodes: string[] = [];
  const addReason = (reason: string, code: string) => {
    if (!reasons.includes(reason)) reasons.push(reason);
    if (!reasonCodes.includes(code)) reasonCodes.push(code);
  };

  let authenticity = fraudScore == null ? 0.7 : clamp(1 - fraudScore, 0, 1);

  if (fraudColor === 'yellow') {
    authenticity = clamp(authenticity - 0.1, 0, 1);
    addReason('Possible fraud signals detected', 'FRAUD_COLOR_YELLOW');
  } else if (fraudColor === 'red') {
    authenticity = clamp(authenticity - 0.35, 0, 1);
    addReason('Possible fraud signals detected', 'FRAUD_COLOR_RED');
  }

  const screenshotSignals = fraudTypes.filter((type) => type.includes('screenshot') || type.includes('lcd photo'));
  if (screenshotSignals.length > 0) {
    authenticity = clamp(authenticity - 0.25, 0, 1);
    addReason('Possible screenshot or LCD photo', 'SCREENSHOT_OR_LCD');
  }

  const duplicateSignals = fraudTypes.filter((type) => type.includes('duplicate'));
  if (duplicateSignals.length > 0) {
    authenticity = clamp(authenticity - 0.45, 0, 1);
    addReason('Duplicate receipt detected', 'DUPLICATE_RECEIPT');
  }

  const tamperSignals = fraudTypes.filter(
    (type) =>
      type.includes('digital tampering') ||
      type.includes('generated document') ||
      type.includes('ai generated') ||
      type.includes('high velocity')
  );
  if (tamperSignals.length > 0) {
    authenticity = clamp(authenticity - 0.2, 0, 1);
    addReason(
      `Possible fraud signals detected (${tamperSignals.join(', ')})`,
      'FRAUD_TYPES'
    );
  }

  const ocrScorePrimary = normalizeUnitInterval(extractNumber(meta.ocr_score));
  const fallbackConfidenceCandidates = collectConfidenceCandidates(record).filter(
    (value) => value >= 0 && value <= 1
  );
  const fallbackAverage =
    fallbackConfidenceCandidates.length > 0
      ? fallbackConfidenceCandidates.reduce((sum, value) => sum + value, 0) / fallbackConfidenceCandidates.length
      : null;
  const ocrScore = ocrScorePrimary ?? fallbackAverage;
  const blurry = hasBlurrySignal(record);

  let extraction = ocrScore ?? 0.65;
  if (blurry) {
    extraction = clamp(extraction - 0.2, 0, 1);
    addReason('Receipt appears blurry', 'BLURRY_IMAGE');
  }

  if (extraction < 0.8) {
    const displayScore = ocrScore == null ? extraction : ocrScore;
    addReason(`Low OCR quality (${Math.round(displayScore * 100)}%)`, 'LOW_OCR_SCORE');
  }

  const vendorName = extractString((record.vendor as UnknownRecord | undefined)?.name);
  const vendors = Array.isArray(record.vendors) ? record.vendors : [];
  const date = extractString(record.date);
  const total = extractNumber(record.total);
  const subtotal = extractNumber(record.subtotal);
  const tax = extractNumber(record.tax);
  const currencyCode = extractString(record.currency_code);
  const payment = (record.payment && typeof record.payment === 'object' ? record.payment : {}) as UnknownRecord;
  const paymentType = extractString(payment.type)?.toLowerCase();
  const cashPaid = extractNumber(payment.cash);
  const changeAmount = extractNumber(payment.change);

  let business = 1;
  if (!vendorName && vendors.length === 0) {
    business -= 0.5;
    addReason('Missing merchant information', 'MISSING_MERCHANT');
  }
  if (!date) {
    business -= 0.3;
    addReason('Missing receipt date', 'MISSING_DATE');
  }
  if (total == null || total <= 0) {
    business -= 0.7;
    addReason('Missing or invalid total', 'INVALID_TOTAL');
  }
  if (!currencyCode) {
    business -= 0.2;
    addReason('Missing currency code', 'MISSING_CURRENCY');
  }
  if (subtotal != null && tax != null && total != null) {
    const mathDiff = Math.abs((subtotal + tax) - total);
    if (mathDiff > 0.05) {
      business -= 0.4;
      addReason('Totals do not add up', 'TOTALS_MISMATCH');
    }
  }
  if (paymentType === 'cash' && cashPaid != null && changeAmount != null && total != null) {
    const cashDiff = Math.abs((cashPaid - changeAmount) - total);
    if (cashDiff > 0.05) {
      business -= 0.4;
      addReason('Cash payment amount does not match total', 'CASH_MISMATCH');
    }
  }
  business = clamp(business, 0, 1);

  const finalScore = (0.45 * authenticity) + (0.35 * extraction) + (0.2 * business);
  const percentReal = Math.round(clamp(finalScore, 0, 1) * 100);

  const catastrophicReject = authenticity < 0.4 || extraction < 0.55 || fraudColor === 'red';
  const approveGate =
    finalScore >= 0.8 &&
    authenticity >= 0.7 &&
    extraction >= 0.8 &&
    business >= 0.7;

  let decision: ReceiptDecision;
  if (catastrophicReject) {
    decision = 'REJECT';
  } else if (approveGate) {
    decision = 'APPROVE';
  } else if (finalScore >= 0.6 || authenticity < 0.7 || extraction < 0.8 || business < 0.7) {
    decision = 'REVIEW';
  } else {
    decision = 'REJECT';
  }

  return {
    decision,
    percentReal,
    scores: {
      authenticity: round3(clamp(authenticity, 0, 1)),
      extraction: round3(clamp(extraction, 0, 1)),
      business: round3(clamp(business, 0, 1)),
    },
    reasons: decision === 'APPROVE' ? [] : reasons,
    reasonCodes: decision === 'APPROVE' ? [] : reasonCodes,
    meta: {
      fraudScore,
      fraudColor,
      fraudTypes,
      ocrScore,
      blurry,
    },
  };
}
