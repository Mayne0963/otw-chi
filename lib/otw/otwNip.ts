import { NipWallet, NipLedgerEntry, OtwRequest } from "./otwTypes";
import { OtwCustomerId, OtwDriverId, newLedgerId } from "./otwIds";
import { Result, ok, err } from "./otwResult";

/**
 * In-memory NIP wallets + ledger.
 * TODO: move to database when we go production.
 */
const nipWallets: NipWallet[] = [];
const nipLedger: NipLedgerEntry[] = [];

/**
 * Internal helpers
 */
const findWalletForCustomer = (customerId: OtwCustomerId): NipWallet | null =>
  nipWallets.find((w) => w.ownerCustomerId === customerId) || null;

const findWalletForDriver = (driverId: OtwDriverId): NipWallet | null =>
  nipWallets.find((w) => w.ownerDriverId === driverId) || null;

/**
 * Ensure wallet exists for a customer.
 */
export const ensureWalletForCustomer = (
  customerId: OtwCustomerId
): NipWallet => {
  const existing = findWalletForCustomer(customerId);
  if (existing) return existing;
  const wallet: NipWallet = {
    ownerCustomerId: customerId,
    ownerDriverId: undefined,
    balance: 0,
    totalEarned: 0,
  };
  nipWallets.push(wallet);
  return wallet;
};

/**
 * Ensure wallet exists for a driver.
 */
export const ensureWalletForDriver = (
  driverId: OtwDriverId
): NipWallet => {
  const existing = findWalletForDriver(driverId);
  if (existing) return existing;
  const wallet: NipWallet = {
    ownerCustomerId: undefined,
    ownerDriverId: driverId,
    balance: 0,
    totalEarned: 0,
  };
  nipWallets.push(wallet);
  return wallet;
};

/**
 * Create a ledger entry and apply delta to wallet.
 */
const applyNipDelta = (args: {
  ownerCustomerId?: OtwCustomerId;
  ownerDriverId?: OtwDriverId;
  delta: number;
  reason: string;
  meta?: Record<string, any>;
}): Result<NipWallet> => {
  if (!args.ownerCustomerId && !args.ownerDriverId) {
    return err("NIP ledger entry must have an owner.");
  }
  let wallet: NipWallet;
  if (args.ownerCustomerId) {
    wallet = ensureWalletForCustomer(args.ownerCustomerId);
  } else {
    wallet = ensureWalletForDriver(args.ownerDriverId as OtwDriverId);
  }
  const entry: NipLedgerEntry = {
    id: newLedgerId(),
    createdAt: new Date().toISOString(),
    ownerCustomerId: args.ownerCustomerId,
    ownerDriverId: args.ownerDriverId,
    delta: args.delta,
    reason: args.reason,
    meta: args.meta || {},
  };
  wallet.balance += args.delta;
  if (args.delta > 0) {
    wallet.totalEarned += args.delta;
  }
  nipLedger.push(entry);
  return ok(wallet);
};

/**
 * Public API: credit NIP (no negative deltas from outside).
 */
export const creditNipToCustomer = (
  customerId: OtwCustomerId,
  amount: number,
  reason: string,
  meta?: Record<string, any>
): Result<NipWallet> => {
  if (amount <= 0) return err("NIP credit must be positive.");
  return applyNipDelta({
    ownerCustomerId: customerId,
    delta: amount,
    reason,
    meta,
  });
};

export const creditNipToDriver = (
  driverId: OtwDriverId,
  amount: number,
  reason: string,
  meta?: Record<string, any>
): Result<NipWallet> => {
  if (amount <= 0) return err("NIP credit must be positive.");
  return applyNipDelta({
    ownerDriverId: driverId,
    delta: amount,
    reason,
    meta,
  });
};

/**
 * Read APIs
 */
export const getWalletForCustomer = (
  customerId: OtwCustomerId
): NipWallet | null => findWalletForCustomer(customerId);

export const getWalletForDriver = (
  driverId: OtwDriverId
): NipWallet | null => findWalletForDriver(driverId);

export const listNipLedgerForCustomer = (
  customerId: OtwCustomerId
): NipLedgerEntry[] =>
  nipLedger
    .filter((e) => e.ownerCustomerId === customerId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );

export const listNipLedgerForDriver = (
  driverId: OtwDriverId
): NipLedgerEntry[] =>
  nipLedger
    .filter((e) => e.ownerDriverId === driverId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );

/**
 * Rewards model for completed OTW request.
 * Simple baseline split.
 */
export interface NipRewardBreakdown {
  customerReward: number;
  driverReward: number;
  baseNip: number;
}

export const computeNipRewardForRequest = (
  request: OtwRequest
): NipRewardBreakdown => {
  const miles = request.estimatedMiles || 0;
  const rawBase = Math.round(miles / 100); // 1 NIP per 100 OTW miles baseline
  const baseNip = rawBase <= 0 ? 1 : rawBase;
  const customerReward = Math.round(baseNip * 0.4);
  const driverReward = Math.round(baseNip * 0.6);
  return {
    customerReward: customerReward <= 0 ? 1 : customerReward,
    driverReward: driverReward <= 0 ? 1 : driverReward,
    baseNip,
  };
};

/**
 * Apply NIP rewards when a request is completed.
 */
export const awardNipForCompletedRequest = (
  request: OtwRequest
): {
  rewards: NipRewardBreakdown;
  customerWallet?: NipWallet | null;
  driverWallet?: NipWallet | null;
  errors?: string[];
} => {
  const errors: string[] = [];
  const rewards = computeNipRewardForRequest(request);
  let customerWallet: NipWallet | null | undefined = null;
  let driverWallet: NipWallet | null | undefined = null;

  if (request.customerId) {
    const res = creditNipToCustomer(
      request.customerId,
      rewards.customerReward,
      "COMPLETED_REQUEST",
      { requestId: request.id }
    );
    if (res.ok) {
      customerWallet = res.data;
    } else {
      errors.push(`Failed to credit customer NIP: ${String(res.error)}`);
    }
  }

  if (request.assignedDriverId) {
    const res = creditNipToDriver(
      request.assignedDriverId,
      rewards.driverReward,
      "COMPLETED_REQUEST",
      { requestId: request.id }
    );
    if (res.ok) {
      driverWallet = res.data;
    } else {
      errors.push(`Failed to credit driver NIP: ${String(res.error)}`);
    }
  }

  return {
    rewards,
    customerWallet,
    driverWallet,
    errors: errors.length ? errors : undefined,
  };
};

