
export interface RequestAnalysis {
  flags: {
    isFragile: boolean;
    isHeavy: boolean;
    hasStairs: boolean;
    requiresTwoPeople: boolean;
  };
}

export interface ComplaintAnalysis {
  category: 'NONE' | 'LATE' | 'DAMAGED' | 'RUDE' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
}

export interface EtaEnhancement {
  originalEtaMinutes: number;
  adjustedEtaMinutes: number;
  factorsApplied: string[];
  confidenceScore: number;
}

export interface DriverCoaching {
  focusArea: string;
  tips: string[];
  praise?: string;
}

export const SAFE_ZONE_PROMPT_7 = `PROMPT 7 — AI ASSIST MODULE (SAFE ZONE)
ROLE:
You are implementing AI helpers that DO NOT directly affect money.
ALLOWED AI USES
Request text → structured flags
Review text → complaint classification
ETA enhancement (non-binding)
Driver coaching suggestions
DISALLOWED
Charging miles
Issuing refunds
Changing payouts
Overriding policies`;

const DISALLOWED_KEY_FRAGMENTS = [
  'charge',
  'cents',
  'fee',
  'miles',
  'payout',
  'policy',
  'price',
  'refund',
  'reimbursement',
  'servicefee',
  'stripe',
  'total',
];

function assertSafeZoneOutput<T>(value: T): T {
  const visited = new WeakSet<object>();

  const visit = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    if (visited.has(node as object)) return;
    visited.add(node as object);

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) visit(node[i], `${path}[${i}]`);
      return;
    }

    for (const [rawKey, child] of Object.entries(node as Record<string, unknown>)) {
      const key = String(rawKey);
      const keyLower = key.toLowerCase().replaceAll('_', '').replaceAll('-', '');
      if (DISALLOWED_KEY_FRAGMENTS.some((frag) => keyLower.includes(frag))) {
        throw new Error(`Safe zone violation: disallowed key "${key}" at ${path}`);
      }
      visit(child, `${path}.${key}`);
    }
  };

  visit(value, '$');
  return value;
}

/**
 * Analyzes request notes to extract structured flags.
 * Uses heuristics for now, can be upgraded to LLM.
 */
export async function analyzeRequestText(text: string): Promise<RequestAnalysis> {
  const lower = text.toLowerCase();
  
  const flags = {
    isFragile: /fragile|glass|break|handle with care|delicate/.test(lower),
    isHeavy: /heavy|weight|lift|big box|furniture/.test(lower),
    hasStairs: /stairs|floor|elevator|steps|walk up/.test(lower),
    requiresTwoPeople: /two people|2 people|two-person|team lift|help carry|need help|assist|couch|sofa|dresser/.test(
      lower
    ),
  };

  return assertSafeZoneOutput({ flags });
}

/**
 * Classifies a complaint/review text.
 * Uses keyword matching for safety, upgradeable to LLM.
 */
export async function classifyComplaint(text: string): Promise<ComplaintAnalysis> {
  const lower = text.toLowerCase();

  if (/late|delay|wait|slow|forever|time/.test(lower)) {
    return assertSafeZoneOutput({
      category: 'LATE',
      severity: 'MEDIUM',
      summary: 'Customer reported timing issues',
    });
  }
  if (/damage|broke|scratch|crushed|ruined/.test(lower)) {
    return assertSafeZoneOutput({
      category: 'DAMAGED',
      severity: 'HIGH',
      summary: 'Customer reported item damage',
    });
  }
  if (/rude|attitude|mean|unprofessional|yell/.test(lower)) {
    return assertSafeZoneOutput({
      category: 'RUDE',
      severity: 'HIGH',
      summary: 'Customer reported behavioral issues',
    });
  }
  
  // Default non-complaint or generic
  if (/terrible|awful|horrible|bad|poor|unacceptable|worst/.test(lower)) {
    return assertSafeZoneOutput({
      category: 'OTHER',
      severity: 'MEDIUM',
      summary: 'Customer expressed dissatisfaction',
    });
  }

  return assertSafeZoneOutput({
    category: 'NONE',
    severity: 'LOW',
    summary: 'No specific complaint detected',
  });
}

/**
 * Enhances ETA based on external factors (mocked here).
 * Non-binding, advisory only.
 */
export async function enhanceEta(
  originalEtaMinutes: number, 
  context: { weather?: string; traffic?: string; timeOfDay?: string }
): Promise<EtaEnhancement> {
  let adjusted = originalEtaMinutes;
  const factors: string[] = [];

  if (context.weather === 'rain' || context.weather === 'snow') {
    adjusted *= 1.2;
    factors.push('Weather delay (+20%)');
  }

  if (context.traffic === 'heavy') {
    adjusted *= 1.3;
    factors.push('Heavy traffic (+30%)');
  }

  if (context.timeOfDay === 'rush_hour') {
    adjusted *= 1.15;
    factors.push('Rush hour buffer (+15%)');
  }

  return assertSafeZoneOutput({
    originalEtaMinutes,
    adjustedEtaMinutes: Math.ceil(adjusted),
    factorsApplied: factors,
    confidenceScore: 0.85,
  });
}

/**
 * Generates coaching tips based on driver metrics.
 * Safe, constructive feedback only.
 */
export async function generateDriverCoaching(metrics: {
  rating: number;
  onTimeRate: number;
  cancelRate: number;
}): Promise<DriverCoaching> {
  const tips: string[] = [];
  let focusArea = 'General Maintenance';
  let praise = undefined;

  if (metrics.rating < 4.8) {
    focusArea = 'Customer Satisfaction';
    tips.push('Try to greet customers by name.');
    tips.push('Check delivery notes for special instructions.');
  } else if (metrics.onTimeRate < 0.9) {
    focusArea = 'Punctuality';
    tips.push('Start your navigation 5 minutes earlier.');
    tips.push('Check traffic before accepting distant jobs.');
  } else if (metrics.cancelRate > 0.1) {
    focusArea = 'Reliability';
    tips.push('Only accept jobs you are certain you can complete.');
    tips.push('Review your schedule before going online.');
  } else {
    focusArea = 'Excellence';
    praise = 'Great job! You are performing at a high level.';
    tips.push('Keep up the great work!');
    tips.push('Consider mentoring new drivers.');
  }

  return assertSafeZoneOutput({
    focusArea,
    tips,
    praise,
  });
}
