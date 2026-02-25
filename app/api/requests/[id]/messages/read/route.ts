import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { serverFeatureFlags } from '@/lib/featureFlags';
import { isRequestParticipant } from '@/lib/request-chat';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!serverFeatureFlags.chat) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const prisma = getPrisma();
  const request = await prisma.deliveryRequest.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      assignedDriverId: true,
      status: true,
      chatEnabled: true,
      chatClosedAt: true,
      assignedDriver: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (!isRequestParticipant(request, { id: user.id, role: user.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ ok: true, readAt: new Date().toISOString() });
}
