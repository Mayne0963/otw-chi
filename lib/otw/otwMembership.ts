// lib/otw/otwMembership.ts

import {
  OtwCustomerId,
  OtwTierId,
} from "./otwIds";
import {
  OtwMembership,
  OtwTierDefinition,
} from "./otwTypes";
import {
  getTierById,
  getDefaultTier,
} from "./otwTierCatalog";
import { ok, err, Result } from "./otwResult";

/**
 * In-memory membership store for early OTW.
 * TODO: replace with database persistence.
 */

const membershipStore: OtwMembership[] = [];

// Seed one mock membership for testing
const __seedToday = new Date();
const __seedNextMonth = new Date(__seedToday);
__seedNextMonth.setMonth(__seedToday.getMonth() + 1);

membershipStore.push({
  customerId: "CUSTOMER-1",
  tierId: (getDefaultTier().id),
  activeSinceIso: __seedToday.toISOString(),
  renewsAtIso: __seedNextMonth.toISOString(),
  milesRemaining: 20_000 - 3_120 + 1_500,
  status: "ACTIVE",
  // extended optional fields for richer mock data
  membershipId: "MEM-1",
  milesCap: 20_000,
  milesUsed: 3_120,
  rolloverMiles: 1_500,
  renewsOn: __seedNextMonth.toISOString(),
  createdAt: __seedToday.toISOString(),
});

/**
 * Get active membership for a customer.
 */
export const getMembershipForCustomer = (
  customerId: OtwCustomerId
): OtwMembership | null => {
  const found = membershipStore.find(
    (m) => m.customerId === customerId && m.status === "ACTIVE"
  );
  return found || null;
};

/**
 * Create a new membership for a customer with a given tier.
 * If no tier is provided, use default tier.
 */
export const createMembershipForCustomer = (args: {
  customerId: OtwCustomerId;
  tierId?: OtwTierId;
}): Result<OtwMembership> => {
  const existing = getMembershipForCustomer(args.customerId);
  if (existing) {
    return err("Customer already has an active membership.");
  }

  const tier: OtwTierDefinition =
    (args.tierId && getTierById(args.tierId)) || getDefaultTier();

  const nowIso = new Date().toISOString();

  const membership: OtwMembership = {
    customerId: args.customerId,
    tierId: tier.id,
    activeSinceIso: nowIso,
    renewsAtIso: undefined, // TODO: add billing cycle
    milesRemaining: tier.includedMiles,
    status: "ACTIVE",
  };

  membershipStore.push(membership);
  return ok(membership);
};

/**
 * Check if a membership can cover a requested OTW miles amount.
 */
export const canCoverMiles = (
  membership: OtwMembership,
  milesNeeded: number
): boolean => {
  if (milesNeeded <= 0) return true;
  return membership.milesRemaining >= milesNeeded;
};

/**
 * Deduct OTW miles from membership.
 * Returns updated membership or error.
 */
export const deductMiles = (
  membership: OtwMembership,
  miles: number
): Result<OtwMembership> => {
  if (miles <= 0) {
    return ok(membership);
  }

  if (!canCoverMiles(membership, miles)) {
    return err("Insufficient OTW miles for this request.");
  }

  membership.milesRemaining -= miles;
  if (membership.milesRemaining < 0) {
    membership.milesRemaining = 0;
  }

  return ok(membership);
};

/**
 * Update membership miles used by delta (positive or negative).
 * Returns updated membership or null if not found by ID.
 */
export const updateMembershipMilesUsed = (
  membershipId: string,
  milesDelta: number
): OtwMembership | null => {
  const m = membershipStore.find((mm) => mm.membershipId === membershipId);
  if (!m) return null;
  const currentUsed = m.milesUsed ?? 0;
  const newUsed = currentUsed + milesDelta;
  m.milesUsed = newUsed < 0 ? 0 : newUsed;
  // keep milesRemaining in sync if present
  if (m.milesCap !== undefined) {
    const rollover = m.rolloverMiles ?? 0;
    const remaining = m.milesCap - m.milesUsed + rollover;
    m.milesRemaining = remaining < 0 ? 0 : remaining;
  }
  return m;
};

/**
 * Estimate remaining miles from combined cap, used, and rollover.
 */
export const estimateRemainingMiles = (membership: OtwMembership): number => {
  const cap = membership.milesCap ?? membership.milesRemaining;
  const used = membership.milesUsed ?? 0;
  const rollover = membership.rolloverMiles ?? 0;
  const remaining = cap - used + rollover;
  return remaining < 0 ? 0 : remaining;
};

/**
 * Soft-cancel a membership (no deletion).
 */
export const cancelMembership = (
  customerId: OtwCustomerId
): Result<OtwMembership> => {
  const membership = getMembershipForCustomer(customerId);
  if (!membership) {
    return err("No active membership found to cancel.");
  }

  membership.status = "CANCELLED";
  membership.renewsAtIso = undefined;
  return ok(membership);
};

/**
 * Recommend an upgrade tier for this membership, if any.
 */
export const getUpgradeRecommendation = (
  membership: OtwMembership
): OtwTierDefinition | null => {
  const current = getTierById(membership.tierId);
  if (!current || !current.recommendedUpgradeTierId) return null;

  return getTierById(current.recommendedUpgradeTierId) || null;
};

/**
 * Ensure a customer has an active membership.
 * If not, create one with the default tier.
 */
export const ensureMembership = (
  customerId: OtwCustomerId
): Result<OtwMembership> => {
  const existing = getMembershipForCustomer(customerId);
  if (existing) return ok(existing);
  return createMembershipForCustomer({ customerId });
};

/**
 * Debug helper: list all memberships (for Admin HQ later).
 */
export const listAllMemberships = (): OtwMembership[] => [
  ...membershipStore,
];
