import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export async function requireUser() {
  const { userId, sessionClaims } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  // Get role from public metadata, defaulting to CUSTOMER if not present
  // Note: Clerk types might need casting depending on your project's setup
  const role = (sessionClaims?.publicMetadata as any)?.role || 'CUSTOMER';

  return { userId, role };
}

export async function requireRole(allowedRoles: string[]) {
  const { userId, role } = await requireUser();

  if (!allowedRoles.includes(role)) {
    // If user is logged in but has wrong role, redirect to access denied
    // or to their dashboard if they have one (but keeping it simple with access-denied)
    redirect('/access-denied');
  }

  return { userId, role };
}
