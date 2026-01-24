
// AI Assist Module (Safe Zone)
// Provides non-financial helpers using heuristics (and prepared for LLM integration).

export interface RequestAnalysis {
  flags: {
    isFragile: boolean;
    isHeavy: boolean;
    hasStairs: boolean;
    requiresTwoPeople: boolean;
  };
  suggestedServiceType?: string;
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
  confidenceScore: number; // 0.0 - 1.0
}

export interface DriverCoaching {
  focusArea: string;
  tips: string[];
  praise?: string;
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
    requiresTwoPeople: /two people|help|assist|heavy|couch|sofa/.test(lower),
  };

  let suggestedServiceType = undefined;
  if (flags.isFragile) suggestedServiceType = 'FRAGILE';
  if (flags.requiresTwoPeople) suggestedServiceType = 'HAUL'; // Assuming HAUL is a valid type mapping to available types

  return {
    flags,
    suggestedServiceType,
  };
}

/**
 * Classifies a complaint/review text.
 * Uses keyword matching for safety, upgradeable to LLM.
 */
export async function classifyComplaint(text: string): Promise<ComplaintAnalysis> {
  const lower = text.toLowerCase();

  if (/late|delay|wait|slow|forever|time/.test(lower)) {
    return { category: 'LATE', severity: 'MEDIUM', summary: 'Customer reported timing issues' };
  }
  if (/damage|broke|scratch|crushed|ruined/.test(lower)) {
    return { category: 'DAMAGED', severity: 'HIGH', summary: 'Customer reported item damage' };
  }
  if (/rude|attitude|mean|unprofessional|yell/.test(lower)) {
    return { category: 'RUDE', severity: 'HIGH', summary: 'Customer reported behavioral issues' };
  }
  
  // Default non-complaint or generic
  return { category: 'NONE', severity: 'LOW', summary: 'No specific complaint detected' };
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

  return {
    originalEtaMinutes,
    adjustedEtaMinutes: Math.ceil(adjusted),
    factorsApplied: factors,
    confidenceScore: 0.85, // Heuristic confidence
  };
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

  return {
    focusArea,
    tips,
    praise,
  };
}
