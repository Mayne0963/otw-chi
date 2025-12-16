import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from '@/lib/db';
import { canTransition } from '@/lib/lifecycle';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const prisma = getPrisma();
    const { id } = await ctx.params;
    const body = await req.json();
    const nextStatus = String(body?.status || '').toUpperCase();
    if (!nextStatus) {
      return NextResponse.json({ success: false, error: 'Missing status' }, { status: 400 });
    }
    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    const from = request.status as any;
    const to = nextStatus as any;
    if (!canTransition(from, to)) {
      return NextResponse.json({ success: false, error: `Invalid transition ${from} -> ${to}` }, { status: 400 });
    }
    const updated = await prisma.request.update({
      where: { id },
      data: { status: to },
    });
    await prisma.requestEvent.create({
      data: { requestId: id, type: `STATUS_${to}`, message: `Status changed to ${to}` },
    });
    return NextResponse.json({ success: true, request: updated });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
