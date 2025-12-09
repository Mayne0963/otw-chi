import { OtwTierDefinition } from "./otwTypes";
import { newTierId } from "./otwIds";
import { ServiceType } from "./otwEnums";

/**
 * Static OTW Tier Catalog
 *
 * NOTE:
 * In a real system this would live in a database or config service.
 * For now we use a readonly in-memory catalog.
 */

const tierIdBadazz = newTierId();
const tierIdHoodHero = newTierId();
const tierIdBossMove = newTierId();

export const OTW_TIER_IDS = {
  BADAZZ: tierIdBadazz,
  HOOD_HERO: tierIdHoodHero,
  BOSS_MOVE: tierIdBossMove,
} as const;

export const OTW_TIER_CATALOG: OtwTierDefinition[] = [
  {
    id: OTW_TIER_IDS.BADAZZ,
    name: "Badazz Tier",
    description:
      "Entry membership for everyday OTW runs — groceries, quick pickups, and local errands.",
    monthlyPriceCents: 180_00, // $180
    includedMiles: 20_000, // OTW miles per month
    perks: [
      "Standard OTW response time",
      "Access to ERRAND & FOOD services",
      "Access to OTW big hauls at base OTW miles pricing",
    ],
    allowedServiceTypes: ["ERRAND", "FOOD", "BIG_HAUL"] as ServiceType[],
    maxMilesPerRequest: 3_500, // prevent single-trip abuse
  },
  {
    id: OTW_TIER_IDS.HOOD_HERO,
    name: "Hood Hero Tier",
    description:
      "Heavy users: multiple runs per week, big hauls, and household logistics.",
    monthlyPriceCents: 320_00, // $320
    includedMiles: 40_000,
    perks: [
      "Priority matching over Badazz",
      "Discounted OTW miles for BIG_HAUL",
      "VIP support window",
    ],
    allowedServiceTypes: ["ERRAND", "FOOD", "BIG_HAUL", "VIP"] as ServiceType[],
    maxMilesPerRequest: 6_000,
    // recommendedUpgradeTierId filled below
  },
  {
    id: OTW_TIER_IDS.BOSS_MOVE,
    name: "Boss Move Tier",
    description:
      "For businesses, polygamous households, and real movers — concierge-level OTW.",
    monthlyPriceCents: 550_00, // $550
    includedMiles: 80_000,
    perks: [
      "Top priority matching",
      "Best OTW miles rate for BIG_HAUL & VIP",
      "Dedicated OTW concierge contact (future feature)",
    ],
    allowedServiceTypes: ["ERRAND", "FOOD", "BIG_HAUL", "VIP"] as ServiceType[],
    maxMilesPerRequest: 10_000,
  },
];

// Link recommendedUpgradeTierId after catalog definition
OTW_TIER_CATALOG.forEach((tier) => {
  if (tier.id === OTW_TIER_IDS.BADAZZ) {
    tier.recommendedUpgradeTierId = OTW_TIER_IDS.HOOD_HERO;
  }
  if (tier.id === OTW_TIER_IDS.HOOD_HERO) {
    tier.recommendedUpgradeTierId = OTW_TIER_IDS.BOSS_MOVE;
  }
});

/**
 * Helpers
 */

export const getTierById = (tierId: string | undefined | null) =>
  OTW_TIER_CATALOG.find((t) => t.id === tierId) || null;

export const getAllTiers = (): OtwTierDefinition[] => [...OTW_TIER_CATALOG];

export const getDefaultTier = (): OtwTierDefinition => OTW_TIER_CATALOG[0];

