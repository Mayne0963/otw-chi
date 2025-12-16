import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = await req.json();
    const driverProfileId = String(body?.driverProfileId || '');
    const status = String(body?.status || '').toUpperCase();
    if (!driverProfileId || !status) {
      return NextResponse.json({ success: false, error: 'Missing driverProfileId or status' }, { status: 400 });
    }
    const updated = await prisma.driverProfile.update({
      where: { id: driverProfileId },
      data: { status },
    });
    return NextResponse.json({ success: true, driver: updated });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

