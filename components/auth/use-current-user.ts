'use client';

import { authClient } from '@/lib/auth/client';
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
  const session = authClient.useSession();
  
  const user = session.data?.user ? {
      id: session.data.user.id,
      email: session.data.user.email || '',
      name: session.data.user.name,
      role: 'CUSTOMER' as UserRole, // Default until fetched
  } : null;

  return {
    user,
    isLoading: session.isPending,
    isSignedIn: !!session.data?.user,
  };
}
