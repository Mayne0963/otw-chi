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
  getAllTiers as catalogGetAllTiers,
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

// Additional helpers for Admin HQ and external modules
export const getAllTiers = (): OtwTierDefinition[] => catalogGetAllTiers();
export const getAllMemberships = (): OtwMembership[] => membershipStore;

export const createMembershipForCustomerAdmin = (
  customerId: string,
  tierId: OtwTierId
): OtwMembership => {
  const tier = getTierById(tierId);
  if (!tier) {
    throw new Error(`Unknown OTW tier: ${tierId}`);
  }

  const now = new Date();
  const renew = new Date(now);
  renew.setMonth(now.getMonth() + 1);

  const existing = membershipStore.find(
    (m) => m.customerId === customerId && m.status !== "CANCELLED"
  );

  if (existing) {
    existing.tierId = tier.id;
    existing.milesCap = tier.includedMiles;
    existing.milesUsed = 0;
    existing.rolloverMiles = existing.rolloverMiles || 0;
    existing.status = "ACTIVE";
    existing.renewsOn = renew.toISOString();
    existing.renewsAtIso = renew.toISOString();
    const rem = (existing.milesCap ?? tier.includedMiles) - (existing.milesUsed ?? 0) + (existing.rolloverMiles ?? 0);
    existing.milesRemaining = rem < 0 ? 0 : rem;
    return existing;
  }

  const membership: OtwMembership = {
    membershipId: `MEM-${membershipStore.length + 1}`,
    customerId,
    tierId: tier.id,
    milesCap: tier.includedMiles,
    milesUsed: 0,
    rolloverMiles: 0,
    status: "ACTIVE",
    renewsOn: renew.toISOString(),
    createdAt: now.toISOString(),
    activeSinceIso: now.toISOString(),
    milesRemaining: tier.includedMiles,
    renewsAtIso: renew.toISOString(),
  };

  membershipStore.push(membership);
  return membership;
};

export const changeCustomerTier = (
  customerId: string,
  newTierId: OtwTierId
): OtwMembership => {
  const tier = getTierById(newTierId);
  if (!tier) {
    throw new Error(`Unknown OTW tier: ${newTierId}`);
  }

  const membership = getMembershipForCustomer(customerId);

  if (!membership) {
    return createMembershipForCustomerAdmin(customerId, newTierId);
  }

  const remaining = estimateRemainingMiles(membership);
  membership.tierId = newTierId;
  membership.milesCap = tier.includedMiles;
  membership.milesUsed = 0;
  membership.rolloverMiles = remaining;
  membership.status = "ACTIVE";

  const now = new Date();
  const renew = new Date(now);
  renew.setMonth(now.getMonth() + 1);
  membership.renewsOn = renew.toISOString();
  membership.renewsAtIso = renew.toISOString();
  const rem2 = (membership.milesCap ?? tier.includedMiles) - (membership.milesUsed ?? 0) + (membership.rolloverMiles ?? 0);
  membership.milesRemaining = rem2 < 0 ? 0 : rem2;

  return membership;
};
