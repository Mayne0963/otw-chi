import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

/**
 * Admin-only endpoint to sync ALL users' Neon DB roles to Clerk publicMetadata.
 * This is useful for initial sync or fixing role inconsistencies.
 * 
 * POST /api/admin/sync-all-roles
 * Body: { dryRun?: boolean } // If true, shows what would be changed without making changes
 */
export async function POST(req: Request) {
  try {
    // Ensure only admins can call this
    await requireRole(['ADMIN']);

    const { dryRun = false } = await req.json().catch(() => ({ dryRun: false }));
    const prisma = getPrisma();
    const client = await clerkClient();

    // Get all users from Neon DB
    const dbUsers = await prisma.user.findMany({
      select: { clerkId: true, role: true, email: true }
    });

    const results = [];
    let updatedCount = 0;

    for (const dbUser of dbUsers) {
      try {
        // Get Clerk user
        const clerkUser = await client.users.getUser(dbUser.clerkId);
        const currentRole = String(clerkUser.publicMetadata?.role || '').toUpperCase();
        const dbRole = dbUser.role;

        if (currentRole !== dbRole) {
          if (!dryRun) {
            await client.users.updateUser(dbUser.clerkId, {
              publicMetadata: {
                ...clerkUser.publicMetadata,
                role: dbRole
              }
            });
            updatedCount++;
          }

          results.push({
            userId: dbUser.clerkId,
            email: dbUser.email,
            oldRole: currentRole,
            newRole: dbRole,
            updated: !dryRun
          });
        }
      } catch (error) {
        console.error(`[SyncAllRoles] Failed to sync user ${dbUser.clerkId}:`, error);
        results.push({
          userId: dbUser.clerkId,
          email: dbUser.email,
          error: error instanceof Error ? error.message : 'Unknown error',
          updated: false
        });
      }
    }

    return NextResponse.json({ 
      success: true,
      dryRun,
      totalUsers: dbUsers.length,
      updatedCount,
      results 
    });

  } catch (error) {
    console.error('[SyncAllRoles] Error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}