import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { calculateDiscount, findActiveCoupon, normalizeCouponCode } from '@/lib/coupons';

const previewSchema = z.object({
  subtotalCents: z.number().int().nonnegative(),
  deliveryFeeCents: z.number().int().nonnegative(),
  couponCode: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
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

    const normalized = normalizeCouponCode(data.couponCode);
    const internalCoupon = await findActiveCoupon(prisma, normalized, user.id);
    if (internalCoupon) {
      const discount = calculateDiscount(
        { subtotalCents: data.subtotalCents, deliveryFeeCents: data.deliveryFeeCents },
        internalCoupon.coupon
      );
      if (discount <= 0 || baseTotal - discount < 50) {
        return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
      }
      return NextResponse.json(
        { discountCents: discount, source: 'internal', code: internalCoupon.coupon.code },
        { status: 200 }
      );
    }

    const stripe = getStripe();
    const promos = await stripe.promotionCodes.list({
      code: normalized,
      active: true,
      limit: 1,
    });

    const promo = promos.data[0];
    const promoCoupon = (promo as any)?.coupon as
      | Stripe.Coupon
      | string
      | null
      | undefined;
    if (!promo || !promoCoupon) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
    }

    const coupon =
      typeof promoCoupon === 'string'
        ? await stripe.coupons.retrieve(promoCoupon)
        : promoCoupon;

    if (!coupon.valid) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
    }

    if (coupon.amount_off && coupon.currency && coupon.currency !== 'usd') {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
    }

    let discount = 0;
    if (coupon.amount_off) {
      discount = Math.min(baseTotal, coupon.amount_off);
    } else if (coupon.percent_off) {
      discount = Math.round((baseTotal * coupon.percent_off) / 100);
    }

    if (discount <= 0 || baseTotal - discount < 50) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
    }

    return NextResponse.json(
      { discountCents: discount, source: 'stripe', code: normalized },
      { status: 200 }
    );
  } catch (error) {
    console.error('[COUPON_PREVIEW]', error);
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
