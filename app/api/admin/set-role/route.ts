import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  try {
    await requireRole(['ADMIN']);
    const body = await req.json();
    const targetClerkId = String(body?.clerkId || '');
    const newRole = String(body?.role || '').toUpperCase();
    if (!targetClerkId || !['CUSTOMER','DRIVER','ADMIN','FRANCHISE'].includes(newRole)) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const client = await clerkClient();
    await client.users.updateUser(targetClerkId, { publicMetadata: { role: newRole } });
    const prisma = getPrisma();
    await prisma.user.update({ where: { clerkId: targetClerkId }, data: { role: newRole as any } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
