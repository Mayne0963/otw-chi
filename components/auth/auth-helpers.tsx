'use client';

import { authClient } from '@/lib/auth/client';

export function SignedIn({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  if (session.data?.user) return <>{children}</>;
  return null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  if (!session.data?.user && !session.isPending) return <>{children}</>;
  return null;
}
