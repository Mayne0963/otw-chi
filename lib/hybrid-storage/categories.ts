export type HybridCategoryKey = "membershipPlansPublic" | "citiesZones";

export type ConflictStrategy = "server_wins" | "client_wins" | "manual";

export type RefreshPolicy = {
  ttlMs: number;
  maxStaleMs: number;
  backgroundRefresh: boolean;
};

export type CategorySpec = {
  key: HybridCategoryKey;
  realtime: boolean;
  description: string;
  storage: "localStorage";
  policy: RefreshPolicy;
  conflict: ConflictStrategy;
};

export const HYBRID_CATEGORIES: Record<HybridCategoryKey, CategorySpec> = {
  membershipPlansPublic: {
    key: "membershipPlansPublic",
    realtime: false,
    description: "Public membership plan catalog used for UI display and reference.",
    storage: "localStorage",
    policy: {
      ttlMs: 6 * 60 * 60 * 1000,
      maxStaleMs: 7 * 24 * 60 * 60 * 1000,
      backgroundRefresh: true,
    },
    conflict: "server_wins",
  },
  citiesZones: {
    key: "citiesZones",
    realtime: false,
    description: "Cities and zones reference data for selectors and display.",
    storage: "localStorage",
    policy: {
      ttlMs: 24 * 60 * 60 * 1000,
      maxStaleMs: 30 * 24 * 60 * 60 * 1000,
      backgroundRefresh: true,
    },
    conflict: "server_wins",
  },
};

export const REALTIME_NEON_DATA = [
  "deliveryRequests",
  "membershipSubscriptions",
  "serviceMilesWallets",
  "serviceMilesLedger",
  "drivers",
  "driverAssignments",
] as const;

export const REFRESHABLE_LOCAL_DATA = Object.keys(HYBRID_CATEGORIES) as HybridCategoryKey[];
