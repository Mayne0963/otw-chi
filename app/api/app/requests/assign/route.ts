import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = await req.json();
    const id = String(body?.id || '');
    const driverProfileId = String(body?.driverProfileId || '');
    if (!id || !driverProfileId) {
      return NextResponse.json({ success: false, error: 'Missing id or driverProfileId' }, { status: 400 });
    }
    const updated = await prisma.request.update({
      where: { id },
      data: { assignedDriverId: driverProfileId, status: 'ASSIGNED' },
    });
    await prisma.requestEvent.create({
      data: { requestId: id, type: 'ASSIGNED', message: `Assigned to driver ${driverProfileId}` },
    });
    return NextResponse.json({ success: true, request: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

