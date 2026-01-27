"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HybridCategoryKey } from "./categories";
import { HYBRID_CATEGORIES } from "./categories";
import { getFreshness } from "./freshness";
import { clearCacheEnvelope, readCacheEnvelopeResult, writeCacheEnvelope } from "./localStorage";
import { recordHybridMetric } from "./metrics";

type RemoteEnvelope<T> = {
  version: string;
  updatedAtIso: string | null;
  data: T;
};

export type HybridState<T> = {
  data: T | null;
  source: "local" | "remote" | null;
  freshness: "fresh" | "stale" | "expired" | "missing";
  version: string | null;
  fetchedAtMs: number | null;
  loading: boolean;
  error: string | null;
};

export function useHybridResource<T>(key: HybridCategoryKey, url: string) {
  const spec = HYBRID_CATEGORIES[key];
  const [state, setState] = useState<HybridState<T>>({
    data: null,
    source: null,
    freshness: "missing",
    version: null,
    fetchedAtMs: null,
    loading: true,
    error: null,
  });

  const inFlight = useRef<AbortController | null>(null);

  const readLocal = useCallback(() => {
    const result = readCacheEnvelopeResult<T>(key);
    if (result.status === "missing") {
      recordHybridMetric({ atMs: Date.now(), key, outcome: "miss", source: "local" });
      return null;
    }
    if (result.status === "corrupt") {
      clearCacheEnvelope(key);
      recordHybridMetric({ atMs: Date.now(), key, outcome: "corrupt", source: "local" });
      return null;
    }
    const env = result.envelope;
    const freshness = getFreshness(key, env.fetchedAtMs);
    recordHybridMetric({
      atMs: Date.now(),
      key,
      outcome: freshness === "fresh" ? "hit" : "hit",
      source: "local",
      cacheAgeMs: Date.now() - env.fetchedAtMs,
      version: env.version,
    });
    return { env, freshness };
  }, [key]);

  const fetchRemote = useCallback(
    async (reason: "init" | "refresh" | "background") => {
      if (inFlight.current) inFlight.current.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      const startMs = Date.now();
      try {
        const res = await fetch(url, { method: "GET", signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as RemoteEnvelope<T>;
        if (!json || typeof json !== "object") {
          throw new Error("Invalid payload");
        }
        if (typeof json.version !== "string" || !json.version) {
          throw new Error("Missing version");
        }
        if (!("data" in json)) {
          throw new Error("Missing data");
        }

        const fetchedAtMs = Date.now();
        writeCacheEnvelope<T>({
          key,
          version: json.version,
          updatedAtIso: json.updatedAtIso ?? null,
          fetchedAtMs,
          data: json.data,
        });

        recordHybridMetric({
          atMs: Date.now(),
          key,
          outcome: "refresh_ok",
          source: "remote",
          durationMs: Date.now() - startMs,
          version: json.version,
        });

        setState({
          data: json.data,
          source: "remote",
          freshness: "fresh",
          version: json.version,
          fetchedAtMs,
          loading: false,
          error: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Refresh failed";
        recordHybridMetric({
          atMs: Date.now(),
          key,
          outcome: "refresh_error",
          source: "remote",
          durationMs: Date.now() - startMs,
        });
        if (reason === "background") return;
        setState((prev) => ({ ...prev, loading: false, error: message }));
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    },
    [key, url]
  );

  const refresh = useCallback(async () => {
    await fetchRemote("refresh");
  }, [fetchRemote]);

  const clear = useCallback(() => {
    clearCacheEnvelope(key);
    setState({
      data: null,
      source: null,
      freshness: "missing",
      version: null,
      fetchedAtMs: null,
      loading: false,
      error: null,
    });
  }, [key]);

  useEffect(() => {
    const local = readLocal();
    if (!local) {
      setState((prev) => ({ ...prev, loading: true, source: null, freshness: "missing" }));
      fetchRemote("init").catch(() => null);
      return;
    }

    const { env, freshness } = local;
    setState({
      data: env.data,
      source: "local",
      freshness,
      version: env.version,
      fetchedAtMs: env.fetchedAtMs,
      loading: false,
      error: null,
    });

    if (spec.policy.backgroundRefresh && freshness !== "fresh") {
      fetchRemote("background").catch(() => null);
    }
  }, [fetchRemote, readLocal, spec.policy.backgroundRefresh]);

  useEffect(() => {
    return () => {
      if (inFlight.current) inFlight.current.abort();
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (state.loading) return "Loading";
    if (state.error) return "Error";
    if (state.freshness === "missing") return "Missing";
    if (state.freshness === "fresh") return "Fresh";
    if (state.freshness === "stale") return "Cached";
    return "Expired";
  }, [state.error, state.freshness, state.loading]);

  return { ...state, refresh, clear, statusLabel, policy: spec.policy };
}
