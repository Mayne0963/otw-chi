import { NextResponse } from 'next/server';
import { getNeonSession } from '@/lib/auth/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const session = await getNeonSession();
    
    if (!session) {
        return NextResponse.json(null, { status: 200 });
    }

    return NextResponse.json(session, { status: 200 });
  } catch (error) {
    console.error('[get-session] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
