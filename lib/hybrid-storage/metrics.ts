import type { HybridCategoryKey } from "./categories";

export type HybridSyncMetric = {
  atMs: number;
  key: HybridCategoryKey;
  outcome: "hit" | "miss" | "refresh_ok" | "refresh_error" | "corrupt";
  source: "local" | "remote";
  durationMs?: number;
  cacheAgeMs?: number;
  version?: string;
};

const METRICS_KEY = "otw:hybrid:metrics:v1";

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function recordHybridMetric(metric: HybridSyncMetric) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(METRICS_KEY);
    const parsed = raw ? safeParseJson(raw) : null;
    const base = Array.isArray(parsed) ? (parsed as HybridSyncMetric[]) : [];
    const next = [...base, metric].slice(-200);
    window.localStorage.setItem(METRICS_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

export function readHybridMetrics() {
  if (typeof window === "undefined") return [] as HybridSyncMetric[];
  try {
    const raw = window.localStorage.getItem(METRICS_KEY);
    if (!raw) return [];
    const parsed = safeParseJson(raw);
    return Array.isArray(parsed) ? (parsed as HybridSyncMetric[]) : [];
  } catch {
    return [];
  }
}
