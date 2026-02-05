import { NextResponse } from 'next/server';
import { getNeonSession } from '@/lib/auth/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const session = await getNeonSession();
    
    // If no session, return null or empty object, depending on what client expects.
    // Usually clients expect { user: ... } or null.
    // getNeonSession returns session?.data which likely contains { user: ... }
    
    if (!session) {
        return NextResponse.json({ session: null }, { status: 200 });
    }

    return NextResponse.json({ session }, { status: 200 });
  } catch (error) {
    console.error('[get-session] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
