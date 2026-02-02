'use client';

import { authClient } from '@/lib/neon-auth';

export function SignedIn({ children }: { children: React.ReactNode }) {
  const session = authClient.auth.useSession();
  if (session.data?.user) return <>{children}</>;
  return null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const session = authClient.auth.useSession();
  if (!session.data?.user && !session.isPending) return <>{children}</>;
  return null;
}
