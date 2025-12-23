import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

/**
 * Utility endpoint to manually set a user's Clerk publicMetadata.role.
 * Only works for the current authenticated user (for security).
 * 
 * POST /api/debug/set-role
 * Body: { role: "ADMIN" | "DRIVER" | "CUSTOMER" | "FRANCHISE" }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { role } = await req.json();
    if (!role || !['ADMIN', 'DRIVER', 'CUSTOMER', 'FRANCHISE'].includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be one of: ADMIN, DRIVER, CUSTOMER, FRANCHISE' 
      }, { status: 400 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

    await client.users.updateUser(userId, {
      publicMetadata: {
        ...clerkUser.publicMetadata,
        role: role
      }
    });

    console.warn(`[DebugSetRole] Manually set role for user ${userId} to ${role}`);

    return NextResponse.json({ 
      success: true, 
      userId,
      newRole: role 
    });

  } catch (error) {
    console.error('[DebugSetRole] Error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}