import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching current user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
