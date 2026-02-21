import type { Prisma } from '@prisma/client';

export type ProofScoreInput = {
  deliveryRequestId: string;
  merchantName?: string | null;
  totalAmount?: number | null;
  confidenceScore?: number | null;
  expectedVendor?: string | null;
  expectedTotal?: number | null;
  menuItems?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  expectedItems?: Prisma.JsonValue;
  imageQuality?: number | null;
  tamperScore?: number | null;
};

export type ProofScoreResult = {
  proofScore: number;
  itemMatchScore: number;
  imageQuality: number;
  tamperScore: number;
  extractedTotal: number | null;
  vendorName: string | null;
  status: 'APPROVED' | 'FLAGGED' | 'REJECTED';
  locked: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeConfidence(confidence: number | null): number {
  if (confidence == null || !Number.isFinite(confidence)) return 0;
  if (confidence >= 0 && confidence <= 1) return confidence * 100;
  if (confidence >= 0 && confidence <= 100) return confidence;
  return 0;
}

function calculateImageQuality(confidenceScore: number | null): number {
  const normalized = normalizeConfidence(confidenceScore);
  return clamp(Math.round(normalized), 0, 100);
}

function calculateTamperScore(): number {
  // Mock tamper detection - in production this would use image analysis
  return Math.floor(Math.random() * 20) + 80; // 80-100 range
}

function normalizeMerchantName(value: string | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/\bstore\s*#?\s*\d+\b/g, ' ')
    .replace(/#\s*\d+\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyMatchScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const buildBigramMultiset = (input: string): Map<string, number> => {
    const map = new Map<string, number>();
    if (input.length < 2) return map;
    for (let i = 0; i < input.length - 1; i += 1) {
      const pair = input.slice(i, i + 2);
      map.set(pair, (map.get(pair) ?? 0) + 1);
    }
    return map;
  };

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

function calculateVendorMatchScore(merchantName: string | null, expectedVendor: string | null): number {
  const normalizedMerchant = normalizeMerchantName(merchantName);
  const normalizedExpected = normalizeMerchantName(expectedVendor);
  
  if (!normalizedMerchant || !normalizedExpected) return 0;
  if (normalizedMerchant === normalizedExpected) return 100;
  
  const fuzzyScore = fuzzyMatchScore(normalizedMerchant, normalizedExpected);
  return clamp(Math.round(fuzzyScore * 100), 0, 100);
}

function parseExpectedItems(expectedItems: Prisma.JsonValue): Array<{name: string, quantity?: number, price?: number}> {
  if (!expectedItems || !Array.isArray(expectedItems)) return [];
  
  return expectedItems.map(item => {
    if (typeof item === 'object' && item !== null) {
      const obj = item as any;
      return {
        name: String(obj.name || ''),
        quantity: typeof obj.quantity === 'number' ? obj.quantity : undefined,
        price: typeof obj.price === 'number' ? obj.price : undefined,
      };
    }
    return { name: String(item), quantity: undefined, price: undefined };
  }).filter(item => item.name);
}

function calculateItemMatchScore(
  extractedItems: Array<{name: string; quantity: number; price: number}>,
  expectedItems: Prisma.JsonValue
): number {
  const expected = parseExpectedItems(expectedItems);
  if (expected.length === 0 || extractedItems.length === 0) return 0;

  let totalScore = 0;
  let maxScore = 0;

  for (const expectedItem of expected) {
    maxScore += 100; // Max score per item
    let bestItemScore = 0;

    for (const extractedItem of extractedItems) {
      let itemScore = 0;

      // Name matching (30 points for exact, 20 for fuzzy)
      const normalizedExpected = normalizeMerchantName(expectedItem.name);
      const normalizedExtracted = normalizeMerchantName(extractedItem.name);
      
      if (normalizedExpected === normalizedExtracted) {
        itemScore += 30;
      } else {
        const fuzzyScore = fuzzyMatchScore(normalizedExpected, normalizedExtracted);
        if (fuzzyScore > 0.7) {
          itemScore += 20;
        }
      }

      // Quantity matching (20 points)
      if (expectedItem.quantity !== undefined && extractedItem.quantity === expectedItem.quantity) {
        itemScore += 20;
      }

      // Price matching (20 points if within $1)
      if (expectedItem.price !== undefined) {
        const priceDiff = Math.abs(extractedItem.price - expectedItem.price);
        if (priceDiff <= 1.00) {
          itemScore += 20;
        }
      }

      // Vendor matching (10 points)
      // This would be calculated separately in vendor score

      bestItemScore = Math.max(bestItemScore, itemScore);
    }

    totalScore += bestItemScore;
  }

  return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
}

function calculateProofScore(input: ProofScoreInput): number {
  let score = 0;
  let factors = 0;

  // Base score from confidence (40% weight)
  if (input.confidenceScore !== null && input.confidenceScore !== undefined) {
    const normalizedConfidence = normalizeConfidence(input.confidenceScore);
    score += normalizedConfidence * 0.4;
    factors += 0.4;
  }

  // Vendor match score (20% weight)
  const vendorScore = calculateVendorMatchScore(input.merchantName ?? null, input.expectedVendor ?? null);
  score += vendorScore * 0.2;
  factors += 0.2;

  // Total amount match (20% weight)
  if (input.totalAmount != null && input.expectedTotal != null) {
    const diff = Math.abs(input.totalAmount - input.expectedTotal);
    if (diff <= 1.00) {
      score += 20 * 0.2; // Perfect match
    } else if (diff <= 5.00) {
      score += 15 * 0.2; // Good match
    } else if (diff <= 10.00) {
      score += 10 * 0.2; // Fair match
    } else {
      score += 5 * 0.2; // Poor match
    }
    factors += 0.2;
  }

  // Image quality score (10% weight)
  const imageQuality = input.imageQuality ?? calculateImageQuality(input.confidenceScore ?? null);
  score += imageQuality * 0.1;
  factors += 0.1;

  // Tamper score (10% weight)
  const tamperScore = input.tamperScore ?? calculateTamperScore();
  score += tamperScore * 0.1;
  factors += 0.1;

  // Normalize score to 0-100 range
  return factors > 0 ? Math.round(score / factors) : 0;
}

export function computeProofScore(input: ProofScoreInput): ProofScoreResult {
  const imageQuality = input.imageQuality ?? calculateImageQuality(input.confidenceScore ?? null);
  const tamperScore = input.tamperScore ?? calculateTamperScore();
  const itemMatchScore = calculateItemMatchScore(input.menuItems || [], input.expectedItems ?? []);
  const proofScore = calculateProofScore({
    ...input,
    imageQuality,
    tamperScore,
  });

  const extractedTotal = input.totalAmount ?? null;
  const vendorName = input.merchantName ?? null;

  // Determine status based on proof score
  let status: 'APPROVED' | 'FLAGGED' | 'REJECTED';
  let locked = false;

  if (proofScore >= 80) {
    status = 'APPROVED';
  } else if (proofScore >= 60) {
    status = 'FLAGGED';
  } else {
    status = 'REJECTED';
  }

  // Auto-lock if status is APPROVED or FLAGGED and itemMatchScore is good
  if ((status === 'APPROVED' || status === 'FLAGGED') && itemMatchScore >= 50) {
    locked = true;
  }

  // Override status if item match score is too low
  if (itemMatchScore < 50 && status === 'APPROVED') {
    status = 'FLAGGED';
  }

  return {
    proofScore,
    itemMatchScore,
    imageQuality,
    tamperScore,
    extractedTotal,
    vendorName,
    status,
    locked,
  };
}
