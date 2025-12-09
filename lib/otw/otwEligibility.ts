import { OtwMembership, OtwTierDefinition } from "./otwTypes";
import { canCoverMiles, getUpgradeRecommendation } from "./otwMembership";
import { Result, ok, err } from "./otwResult";

export interface RequestEligibilityInfo {
  eligible: boolean;
  reason?: string;
  suggestedUpgradeTier?: OtwTierDefinition | null;
}

/**
 * Determine if a given membership is allowed to run a request
 * for a given OTW miles amount.
 */
export const evaluateRequestEligibility = (
  membership: OtwMembership,
  tier: OtwTierDefinition,
  milesNeeded: number
): Result<RequestEligibilityInfo, RequestEligibilityInfo> => {
  if (milesNeeded <= 0) {
    return ok({
      eligible: true,
      reason: "No OTW miles needed.",
      suggestedUpgradeTier: null,
    });
  }

  if (tier.maxMilesPerRequest && milesNeeded > tier.maxMilesPerRequest) {
    const suggestedUpgradeTier = getUpgradeRecommendation(membership);
    return err({
      eligible: false,
      reason: `This request requires ${milesNeeded} OTW miles, which exceeds your tier's per-request cap of ${tier.maxMilesPerRequest}.`,
      suggestedUpgradeTier: suggestedUpgradeTier || null,
    });
  }

  if (!canCoverMiles(membership, milesNeeded)) {
    const suggestedUpgradeTier = getUpgradeRecommendation(membership);
    return err({
      eligible: false,
      reason: `You do not have enough OTW miles to cover this request.`,
      suggestedUpgradeTier: suggestedUpgradeTier || null,
    });
  }

  return ok({
    eligible: true,
    reason: "Membership can cover this request.",
    suggestedUpgradeTier: null,
  });
};

