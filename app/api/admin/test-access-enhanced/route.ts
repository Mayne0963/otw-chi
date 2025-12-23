import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

/**
 * Enhanced admin test endpoint with detailed authentication state verification.
 * This should only be accessible to users with ADMIN role.
 * 
 * GET /api/admin/test-access-enhanced
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
      console.warn('[AdminTestEnhanced] Failed to fetch Clerk user:', error);
    }

    try {
      dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, role: true, email: true, createdAt: true }
      });
    } catch (error) {
      console.warn('[AdminTestEnhanced] Failed to fetch DB user:', error);
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

    // Check if user has admin access
    const hasAdminAccess = sessionRole === 'ADMIN' || clerkRole === 'ADMIN' || dbRole === 'ADMIN';
    
    if (!hasAdminAccess) {
      return NextResponse.json({ 
        error: 'Admin access required',
        authenticated: true,
        userId,
        roleResolution: {
          sessionRole,
          clerkRole,
          dbRole,
          finalRole: sessionRole || clerkRole || dbRole
        },
        message: 'User does not have ADMIN role in any system'
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin access verified!',
      authenticated: true,
      userId,
      sessionId: sessionId || null,
      roleResolution: {
        sessionRole,
        clerkRole,
        dbRole,
        finalRole: sessionRole || clerkRole || dbRole,
        source: sessionRole ? 'session' : clerkRole ? 'clerk' : 'database'
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
    console.error('[AdminTestEnhanced] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ 
      error: message,
      authenticated: false 
    }, { status: 500 });
  }
}