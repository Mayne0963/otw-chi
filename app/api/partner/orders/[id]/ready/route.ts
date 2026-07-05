import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { isAuthorizedPartnerRequest } from '@/lib/partner-auth';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedPartnerRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const prisma = getPrisma();

  const request = await prisma.deliveryRequest.findUnique({ where: { id } });
  if (!request) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const readyNote = `[Food ready for pickup at ${new Date().toISOString()}]`;
  await prisma.deliveryRequest.update({
    where: { id },
    data: {
      // Marking ready-for-pickup makes the request eligible for dispatch now.
      dispatchAt: new Date(),
      notes: request.notes ? `${request.notes}\n${readyNote}` : readyNote,
    },
  });

  return NextResponse.json({ success: true });
}
