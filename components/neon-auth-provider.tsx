'use client';

import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react';
import { authClient } from '@/lib/neon-auth';

export function AppNeonAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider authClient={authClient.auth}>
      {children}
    </NeonAuthUIProvider>
  );
}
