import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

/**
 * Enhanced debug endpoint to check current user's complete authentication state.
 * Provides detailed information about role resolution and session claims.
 * 
 * GET /api/debug/auth-state
 */
export async function GET() {
  try {
    const { userId, sessionClaims, sessionId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Not authenticated',
        authenticated: false,
        sessionId: sessionId || null
      }, { status: 401 });
    }

    const prisma = getPrisma();
    const client = await clerkClient();

    // Get complete user information
    let clerkUser;
    let dbUser;
    
    try {
      clerkUser = await client.users.getUser(userId);
    } catch (error) {
      console.error('[AuthState] Failed to fetch Clerk user:', error);
    }

    try {
      dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, role: true, email: true, createdAt: true }
      });
    } catch (error) {
      console.error('[AuthState] Failed to fetch DB user:', error);
    }

    // Enhanced role resolution
    const sessionRole = String(
      (sessionClaims as { publicMetadata?: { role?: string }; metadata?: { role?: string }; otw?: { role?: string } })?.publicMetadata?.role ?? 
      (sessionClaims as { publicMetadata?: { role?: string }; metadata?: { role?: string }; otw?: { role?: string } })?.metadata?.role ?? 
      (sessionClaims as { publicMetadata?: { role?: string }; metadata?: { role?: string }; otw?: { role?: string } })?.otw?.role ?? 
      ''
    ).toUpperCase();

    const clerkRole = clerkUser ? String(clerkUser.publicMetadata?.role || '').toUpperCase() : '';
    const dbRole = dbUser?.role || 'CUSTOMER';

    // Check for role mismatches
    const roleIssues = [];
    if (sessionRole && sessionRole !== dbRole) {
      roleIssues.push(`Session role (${sessionRole}) doesn't match DB role (${dbRole})`);
    }
    if (clerkRole && clerkRole !== dbRole) {
      roleIssues.push(`Clerk role (${clerkRole}) doesn't match DB role (${dbRole})`);
    }
    if (!sessionRole && !clerkRole) {
      roleIssues.push('No role found in session or Clerk metadata');
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      userId,
      sessionId: sessionId || null,
      roleResolution: {
        sessionRole,
        clerkRole,
        dbRole,
        finalRole: sessionRole || clerkRole || dbRole,
        issues: roleIssues,
        needsSync: roleIssues.length > 0
      },
      userData: {
        clerk: clerkUser ? {
          id: clerkUser.id,
          email: clerkUser.emailAddresses?.[0]?.emailAddress || 'unknown',
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Unknown',
          publicMetadata: clerkUser.publicMetadata
        } : null,
        database: dbUser || null
      },
      sessionClaims: sessionClaims || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AuthState] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ 
      error: message,
      authenticated: false 
    }, { status: 500 });
  }
}