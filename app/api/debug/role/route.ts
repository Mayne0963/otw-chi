import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

/**
 * Utility endpoint to check current user's role from both Clerk and Neon DB.
 * Useful for debugging role resolution issues.
 * 
 * GET /api/debug/role
 * Returns: { clerkRole, dbRole, userId, email }
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const prisma = getPrisma();
    const client = await clerkClient();

    // Get Clerk user and role
    const clerkUser = await client.users.getUser(userId);
    const clerkRole = String(clerkUser.publicMetadata?.role || '').toUpperCase();

    // Get Neon DB user and role
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true, email: true }
    });

    if (!dbUser) {
      return NextResponse.json({ 
        error: 'User not found in database',
        clerkRole,
        userId 
      }, { status: 404 });
    }

    return NextResponse.json({
      clerkRole,
      dbRole: dbUser.role,
      userId,
      email: dbUser.email,
      rolesMatch: clerkRole === dbUser.role
    });

  } catch (error) {
    console.error('[DebugRole] Error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}