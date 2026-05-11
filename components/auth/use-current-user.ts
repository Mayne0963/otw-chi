'use client';

import { useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/auth/client';
export type UserRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE';

export interface UseCurrentUserReturn {
  isLoading: boolean;
  isSignedIn: boolean;
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: UserRole;
  } | null;
}

type ApiCurrentUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: UserRole;
};

function asRole(value: unknown): UserRole | null {
  if (value === 'CUSTOMER' || value === 'DRIVER' || value === 'ADMIN' || value === 'FRANCHISE') {
    return value;
  }
  return null;
}

export function useCurrentUser(): UseCurrentUserReturn {
  const session = authClient.useSession();
  const sessionUser = session.data?.user ?? null;
  const [dbUser, setDbUser] = useState<ApiCurrentUser | null>(null);
  const [dbLoading, setDbLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!sessionUser?.id) {
      queueMicrotask(() => {
        if (cancelled) return;
        setDbUser(null);
        setDbLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) setDbLoading(true);
    });

    fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`auth/me failed (${res.status})`);
        }
        const payload = (await res.json().catch(() => ({}))) as { user?: unknown };
        const user = (payload.user && typeof payload.user === 'object'
          ? payload.user
          : null) as (Record<string, unknown> | null);
        if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') return null;
        return {
          id: user.id,
          email: user.email,
          name: typeof user.name === 'string' ? user.name : null,
          role: asRole(user.role) ?? undefined,
        } satisfies ApiCurrentUser;
      })
      .then((user) => {
        if (cancelled) return;
        setDbUser(user);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[useCurrentUser] failed to load /api/auth/me:', error);
        }
      })
      .finally(() => {
        if (!cancelled) setDbLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionUser?.id]);

  const user = useMemo(() => {
    if (!sessionUser) return null;
    const sessionRecord = sessionUser as unknown as Record<string, unknown>;
    const sessionPublicMetadata =
      sessionRecord.publicMetadata && typeof sessionRecord.publicMetadata === 'object'
        ? (sessionRecord.publicMetadata as Record<string, unknown>)
        : null;

    const sessionRole =
      asRole(sessionRecord.role) ??
      asRole(sessionPublicMetadata?.role);

    return {
      id: dbUser?.id ?? sessionUser.id,
      email: dbUser?.email ?? sessionUser.email ?? '',
      name: dbUser?.name ?? sessionUser.name ?? null,
      role: dbUser?.role ?? sessionRole ?? 'CUSTOMER',
    };
  }, [dbUser, sessionUser]);

  return {
    user,
    isLoading: session.isPending || (Boolean(sessionUser) && dbLoading),
    isSignedIn: Boolean(sessionUser),
  };
}
