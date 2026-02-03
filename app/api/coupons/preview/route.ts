import { NextResponse } from 'next/server';
import { getNeonSession } from '@/lib/auth/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { ADMIN_FREE_COUPON_CODE, isAdminFreeCoupon } from '@/lib/admin-discount';

const previewSchema = z.object({
  subtotalCents: z.number().int().nonnegative(),
  deliveryFeeCents: z.number().int().nonnegative(),
  couponCode: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const session = await getNeonSession();
    // @ts-ignore
    const userId = session?.userId || session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = previewSchema.parse(body);
    const baseTotal = data.subtotalCents + data.deliveryFeeCents;
    if (baseTotal <= 0) {
      return NextResponse.json({ error: 'Invalid total' }, { status: 400 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isAdminFreeCoupon(data.couponCode)) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
    }

    return NextResponse.json(
      { discountCents: baseTotal, source: 'admin', code: ADMIN_FREE_COUPON_CODE, free: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('[COUPON_PREVIEW]', error);
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
