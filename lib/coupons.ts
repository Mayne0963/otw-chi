import type { PrismaClient, PromoCode } from "@prisma/client";

type CouponTotals = {
  subtotalCents: number;
  deliveryFeeCents: number;
};

type CouponResult = {
  coupon: PromoCode;
  discountCents: number;
};

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

export async function findActiveCoupon(
  prisma: PrismaClient,
  code: string,
  userId: string
): Promise<CouponResult | null> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;

  const coupon = await prisma.promoCode.findUnique({
    where: { code: normalized },
  });

  if (!coupon || !coupon.active) return null;

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return null;
  if (coupon.endsAt && coupon.endsAt < now) return null;
  if (coupon.maxRedemptions && coupon.redemptions >= coupon.maxRedemptions) return null;

  const existing = await prisma.promoRedemption.findUnique({
    where: {
      promoCodeId_userId: {
        promoCodeId: coupon.id,
        userId,
      },
    },
  });

  if (existing) return null;

  return {
    coupon,
    discountCents: 0,
  };
}

export function calculateDiscount(
  totals: CouponTotals,
  coupon: PromoCode
): number {
  const baseTotal = totals.subtotalCents + totals.deliveryFeeCents;
  if (baseTotal <= 0) return 0;

  if (coupon.amountOffCents && coupon.amountOffCents > 0) {
    return Math.min(baseTotal, coupon.amountOffCents);
  }

  if (coupon.percentOff && coupon.percentOff > 0) {
    const raw = Math.round((baseTotal * coupon.percentOff) / 100);
    return Math.min(baseTotal, raw);
  }

  return 0;
}

export async function recordCouponRedemption(
  prisma: PrismaClient,
  coupon: PromoCode,
  userId: string,
  orderId?: string
) {
  await prisma.$transaction([
    prisma.promoCode.update({
      where: { id: coupon.id },
      data: { redemptions: { increment: 1 } },
    }),
    prisma.promoRedemption.create({
      data: {
        promoCodeId: coupon.id,
        userId,
        orderId,
      },
    }),
  ]);
}
