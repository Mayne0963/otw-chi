import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/roles';
import { removeDeliveryRequestLock } from '@/lib/refunds/lock';

const unlockPayloadSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let adminUser: Awaited<ReturnType<typeof requireRole>>;
  try {
    adminUser = await requireRole(['ADMIN']);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = unlockPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrisma();
  
  // Check if delivery request exists
  const deliveryRequest = await prisma.deliveryRequest.findUnique({
    where: { id },
    select: {
      id: true,
      isLocked: true,
    },
  });

  if (!deliveryRequest) {
    return NextResponse.json({ error: 'Delivery request not found' }, { status: 404 });
  }

  if (!deliveryRequest.isLocked) {
    return NextResponse.json({ error: 'Delivery request is not locked' }, { status: 400 });
  }

  try {
    await removeDeliveryRequestLock(id, adminUser.id, parsed.data.reason);
    
    return NextResponse.json({
      ok: true,
      message: 'Delivery request unlocked successfully',
      deliveryRequestId: id,
    });
  } catch (error) {
    console.error('Error unlocking delivery request:', error);
    return NextResponse.json(
      { error: 'Failed to unlock delivery request' },
      { status: 500 }
    );
  }
}