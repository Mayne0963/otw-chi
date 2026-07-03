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

function readMetricsStorageValue(): string | null {
  const sessionValue = window.sessionStorage.getItem(METRICS_KEY);
  if (sessionValue !== null) return sessionValue;
  const legacyLocalValue = window.localStorage.getItem(METRICS_KEY);
  if (legacyLocalValue === null) return null;
  window.sessionStorage.setItem(METRICS_KEY, legacyLocalValue);
  window.localStorage.removeItem(METRICS_KEY);
  return legacyLocalValue;
}

function writeMetricsStorageValue(value: string) {
  window.sessionStorage.setItem(METRICS_KEY, value);
  window.localStorage.removeItem(METRICS_KEY);
}

export function recordHybridMetric(metric: HybridSyncMetric) {
  if (typeof window === "undefined") return;
  try {
    const raw = readMetricsStorageValue();
    const parsed = raw ? safeParseJson(raw) : null;
    const base = Array.isArray(parsed) ? (parsed as HybridSyncMetric[]) : [];
    const next = [...base, metric].slice(-200);
    writeMetricsStorageValue(JSON.stringify(next));
  } catch {
    return;
  }
}

export function readHybridMetrics() {
  if (typeof window === "undefined") return [] as HybridSyncMetric[];
  try {
    const raw = readMetricsStorageValue();
    if (!raw) return [];
    const parsed = safeParseJson(raw);
    return Array.isArray(parsed) ? (parsed as HybridSyncMetric[]) : [];
  } catch {
    return [];
  }
}
