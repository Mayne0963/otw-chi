import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from '@/lib/db';
import { canTransition, RequestStatus } from '@/lib/lifecycle';

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
    const from = request.status as RequestStatus;
    const to = nextStatus as RequestStatus;
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
    if (to === 'COMPLETED') {
      const customerId = updated.customerId;
      const miles = Number(updated.milesEstimate || 0);
      const sub = await prisma.membershipSubscription.findUnique({ where: { userId: customerId }, include: { plan: true } });
      const plan = sub?.plan;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mRaw = (plan as any)?.nipMultiplier;
      const multiplier = typeof mRaw === 'number' ? mRaw : 1.0;
      const nipReward = Math.max(0, Math.round(miles * 5 * multiplier));
      if (nipReward > 0) {
        await prisma.nIPLedger.create({
          data: { userId: customerId, requestId: id, amount: nipReward, type: 'COMPLETION_REWARD' },
        });
      }
    }
    return NextResponse.json({ success: true, request: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
