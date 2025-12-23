import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Test endpoint to verify admin access is working.
 * This should only be accessible to users with ADMIN role.
 * 
 * GET /api/admin/test-access
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Log session claims for debugging
    console.warn('[AdminTest] Session claims:', JSON.stringify(sessionClaims, null, 2));

    const role = String(
      (sessionClaims as { publicMetadata?: { role?: string }; metadata?: { role?: string }; otw?: { role?: string } })?.publicMetadata?.role ?? 
      (sessionClaims as { publicMetadata?: { role?: string }; metadata?: { role?: string }; otw?: { role?: string } })?.metadata?.role ?? 
      (sessionClaims as { publicMetadata?: { role?: string }; metadata?: { role?: string }; otw?: { role?: string } })?.otw?.role ?? 
      ''
    ).toUpperCase();

    return NextResponse.json({
      success: true,
      message: 'Admin access verified!',
      userId,
      role,
      sessionClaims: sessionClaims // Include full claims for debugging
    });

  } catch (error) {
    console.error('[AdminTest] Error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}