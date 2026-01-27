import { hashStringFNV1a } from "./hash";
import type { HybridCategoryKey } from "./categories";

export type CacheEnvelope<T> = {
  schema: 1;
  key: HybridCategoryKey;
  version: string;
  updatedAtIso: string | null;
  fetchedAtMs: number;
  checksum: string;
  data: T;
};

const STORAGE_PREFIX = "otw:hybrid:";

function storageKey(key: HybridCategoryKey) {
  return `${STORAGE_PREFIX}${key}`;
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function computeChecksum<T>(data: T) {
  return hashStringFNV1a(JSON.stringify(data));
}

export type CacheReadResult<T> =
  | { status: "missing"; envelope: null }
  | { status: "corrupt"; envelope: null }
  | { status: "ok"; envelope: CacheEnvelope<T> };

export function readCacheEnvelopeResult<T>(key: HybridCategoryKey): CacheReadResult<T> {
  if (typeof window === "undefined") return { status: "missing", envelope: null };
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return { status: "missing", envelope: null };
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== "object") return { status: "corrupt", envelope: null };

    const env = parsed as Partial<CacheEnvelope<T>>;
    if (env.schema !== 1) return { status: "corrupt", envelope: null };
    if (env.key !== key) return { status: "corrupt", envelope: null };
    if (typeof env.version !== "string" || !env.version) return { status: "corrupt", envelope: null };
    if (typeof env.fetchedAtMs !== "number" || !Number.isFinite(env.fetchedAtMs)) return { status: "corrupt", envelope: null };
    if (typeof env.checksum !== "string" || !env.checksum) return { status: "corrupt", envelope: null };
    if (!("data" in env)) return { status: "corrupt", envelope: null };

    const expected = computeChecksum(env.data as T);
    if (expected !== env.checksum) return { status: "corrupt", envelope: null };

    return { status: "ok", envelope: env as CacheEnvelope<T> };
  } catch {
    return { status: "corrupt", envelope: null };
  }
}

export function readCacheEnvelope<T>(key: HybridCategoryKey): CacheEnvelope<T> | null {
  const result = readCacheEnvelopeResult<T>(key);
  return result.status === "ok" ? result.envelope : null;
}

export function writeCacheEnvelope<T>(envelope: Omit<CacheEnvelope<T>, "schema" | "checksum">) {
  if (typeof window === "undefined") return;
  const checksum = computeChecksum(envelope.data);
  const full: CacheEnvelope<T> = {
    schema: 1,
    ...envelope,
    checksum,
  };
  window.localStorage.setItem(storageKey(envelope.key), JSON.stringify(full));
}

export function clearCacheEnvelope(key: HybridCategoryKey) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(key));
}
