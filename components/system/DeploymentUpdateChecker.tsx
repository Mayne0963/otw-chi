'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const VERSION_STORAGE_KEY = 'otw:deployment-version';
const RELOAD_GUARD_KEY = 'otw:deployment-reload-guard';
const RELOAD_GUARD_TTL_MS = 60_000;

type VersionResponse = {
  version?: string;
};

async function fetchDeploymentVersion(signal?: AbortSignal): Promise<string | null> {
  const response = await fetch('/api/app-version', {
    method: 'GET',
    cache: 'no-store',
    signal,
    headers: {
      'cache-control': 'no-cache',
    },
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as VersionResponse;
  if (typeof payload.version !== 'string' || !payload.version) return null;
  return payload.version;
}

function shouldSkipReloadForVersion(version: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { version?: string; at?: number };
    if (parsed.version !== version) return false;
    if (typeof parsed.at !== 'number') return false;
    return Date.now() - parsed.at < RELOAD_GUARD_TTL_MS;
  } catch {
    return false;
  }
}

async function refreshServiceWorkersAndCaches(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
  }

  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    const otwCacheKeys = keys.filter((key) => key.startsWith('otw-'));
    await Promise.all(otwCacheKeys.map((key) => caches.delete(key).catch(() => false)));
  }
}

export default function DeploymentUpdateChecker() {
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const checkForUpdate = async () => {
      const version = await fetchDeploymentVersion(controller.signal);
      if (!active || !version) return;

      let previousVersion: string | null = null;
      try {
        previousVersion = window.localStorage.getItem(VERSION_STORAGE_KEY);
      } catch {
        previousVersion = null;
      }

      if (!previousVersion) {
        try {
          window.localStorage.setItem(VERSION_STORAGE_KEY, version);
        } catch {
          // ignore storage failures
        }
        return;
      }

      if (previousVersion === version) return;

      try {
        window.localStorage.setItem(VERSION_STORAGE_KEY, version);
      } catch {
        // ignore storage failures
      }

      if (shouldSkipReloadForVersion(version)) return;

      try {
        window.sessionStorage.setItem(
          RELOAD_GUARD_KEY,
          JSON.stringify({ version, at: Date.now() })
        );
      } catch {
        // ignore storage failures
      }

      await refreshServiceWorkersAndCaches();
      window.location.reload();
    };

    checkForUpdate().catch(() => undefined);

    return () => {
      active = false;
      controller.abort();
    };
  }, [pathname]);

  return null;
}
