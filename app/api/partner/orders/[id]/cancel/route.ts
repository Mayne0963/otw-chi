import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { isAuthorizedPartnerRequest } from '@/lib/partner-auth';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedPartnerRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  let reason = '';
  try {
    const body = (await req.json()) as { reason?: string };
    reason = body?.reason?.trim() || '';
  } catch {
    // reason is optional
  }

  const prisma = getPrisma();
  const request = await prisma.deliveryRequest.findUnique({ where: { id } });
  if (!request) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (request.status === 'DELIVERED') {
    return NextResponse.json({ error: 'Order already delivered' }, { status: 409 });
  }

  const cancelNote = `[Canceled by partner${reason ? `: ${reason}` : ''}]`;
  await prisma.deliveryRequest.update({
    where: { id },
    data: {
      status: 'CANCELED',
      notes: request.notes ? `${request.notes}\n${cancelNote}` : cancelNote,
    },
  });

  return NextResponse.json({ success: true });
}
