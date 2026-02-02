'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/neon-auth';
// @ts-ignore
// import { UserRole } from "@prisma/client";

// Define locally if import fails or is not generated yet
export type UserRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'FRANCHISE';

export interface UseCurrentUserReturn {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string;
    role?: UserRole;
    publicMetadata: {
      role?: UserRole;
    };
  } | null | undefined;
}

export function useCurrentUser() {
  const session = authClient.auth.useSession();
  const [dbUser, setDbUser] = useState<{ id: string; role: UserRole; email: string; name?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session.isPending && session.data?.user) {
        // Here we ideally fetch the DB user if we need role/id
        // For now, mapping session user
        // Note: Real implementation should fetch from /api/user/me or similar if role is needed
        setDbUser({
            id: session.data.user.id,
            email: session.data.user.email || '',
            name: session.data.user.name,
            role: 'CUSTOMER', // Default until fetched
        });
        setLoading(false);
    } else if (!session.isPending) {
        setDbUser(null);
        setLoading(false);
    }
  }, [session.data, session.isPending]);

  return {
    user: dbUser,
    isLoading: loading || session.isPending,
    isSignedIn: !!session.data?.user,
  };
}
