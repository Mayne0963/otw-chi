import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOtwToken } from '@/lib/auth';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = await getOtwToken();
  if (!token) {
    return NextResponse.json({ error: 'TokenUnavailable' }, { status: 500 });
  }
  return NextResponse.json({ token });
}

