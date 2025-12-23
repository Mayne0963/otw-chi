import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

/**
 * Admin-only endpoint to sync a user's Neon DB role to Clerk publicMetadata.
 * This ensures the Clerk session token contains the correct role for middleware checks.
 * 
 * POST /api/admin/sync-role-to-clerk
 * Body: { userId?: string } // If omitted, syncs the current admin user
 */
export async function POST(req: Request) {
  try {
    // Ensure only admins can call this
    await requireRole(['ADMIN']);

    const prisma = getPrisma();
    const { userId: targetUserId } = await req.json().catch(() => ({}));

    // If no target user specified, sync the current admin user
    const { userId: currentUserId } = await auth();
    if (!currentUserId) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const userIdToSync = targetUserId || currentUserId;

    // Get user from Neon DB
    const user = await prisma.user.findUnique({
      where: { clerkId: userIdToSync },
      select: { role: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found in database' }, { status: 404 });
    }

    // Get Clerk client
    const client = await clerkClient();

    // Get current Clerk user to check existing metadata
    const clerkUser = await client.users.getUser(userIdToSync);
    const currentRole = String(clerkUser.publicMetadata?.role || '').toUpperCase();
    const newRole = user.role;

    // Only update if role has changed
    if (currentRole !== newRole) {
      await client.users.updateUser(userIdToSync, {
        publicMetadata: {
          ...clerkUser.publicMetadata,
          role: newRole
        }
      });

      console.warn(`[SyncRoleToClerk] Updated user ${userIdToSync} role from ${currentRole} to ${newRole}`);
    } else {
      console.warn(`[SyncRoleToClerk] User ${userIdToSync} role already synced: ${newRole}`);
    }

    return NextResponse.json({ 
      success: true, 
      userId: userIdToSync,
      role: newRole,
      updated: currentRole !== newRole 
    });

  } catch (error) {
    console.error('[SyncRoleToClerk] Error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}