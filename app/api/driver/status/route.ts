import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/roles';
import { MembershipStatus } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const user = await requireRole(['DRIVER', 'ADMIN']);
    const prisma = getPrisma();
    const body = await req.json();
    const driverProfileId = String(body?.driverProfileId || '');
    const status = String(body?.status || '').toUpperCase() as MembershipStatus;
    
    if (!driverProfileId || !status) {
      return NextResponse.json({ success: false, error: 'Missing driverProfileId or status' }, { status: 400 });
    }

    // Verify ownership if not admin
    if (user.role !== 'ADMIN') {
      const driverProfile = await prisma.driverProfile.findUnique({ where: { id: driverProfileId } });
      if (!driverProfile || driverProfile.userId !== user.id) {
         return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const updated = await prisma.driverProfile.update({
      where: { id: driverProfileId },
      data: { status },
    });
    return NextResponse.json({ success: true, driver: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

