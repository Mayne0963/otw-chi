import type { HybridCategoryKey } from "./categories";
import { HYBRID_CATEGORIES } from "./categories";

export type CacheFreshness = "fresh" | "stale" | "expired";

export function getFreshness(key: HybridCategoryKey, fetchedAtMs: number, nowMs = Date.now()): CacheFreshness {
  const spec = HYBRID_CATEGORIES[key];
  const age = Math.max(0, nowMs - fetchedAtMs);
  if (age <= spec.policy.ttlMs) return "fresh";
  if (age <= spec.policy.maxStaleMs) return "stale";
  return "expired";
}
