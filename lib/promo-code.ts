
import { PrismaClient } from "@prisma/client";

export type PromoCodeValidationResult = 
  | { valid: true; promoCode: { id: string; code: string; percentOff: number | null; amountOffCents: number | null } }
  | { valid: false; error: string };

export async function validatePromoCode(
  code: string,
  userId: string,
  prisma: PrismaClient | any // Allow any for mocking ease if needed
): Promise<PromoCodeValidationResult> {
  if (!code) {
    return { valid: false, error: "Code is required" };
  }

  // 1. Find the code
  const promo = await prisma.promoCode.findUnique({
    where: { code },
  });

  if (!promo) {
    return { valid: false, error: "Invalid promo code" };
  }

  // 2. Check active status
  if (!promo.active) {
    return { valid: false, error: "Promo code is inactive" };
  }

  // 3. Check dates
  const now = new Date();
  if (promo.startsAt && now < promo.startsAt) {
    return { valid: false, error: "Promo code not yet active" };
  }
  if (promo.endsAt && now > promo.endsAt) {
    return { valid: false, error: "Promo code expired" };
  }

  // 4. Check global limits
  if (promo.maxRedemptions !== null && promo.redemptions >= promo.maxRedemptions) {
    return { valid: false, error: "Promo code usage limit reached" };
  }

  // 5. Check user redemption history (Single use per user)
  const existingRedemption = await prisma.promoRedemption.findUnique({
    where: {
      promoCodeId_userId: {
        promoCodeId: promo.id,
        userId: userId,
      },
    },
  });

  if (existingRedemption) {
    return { valid: false, error: "You have already used this promo code" };
  }

  return {
    valid: true,
    promoCode: {
      id: promo.id,
      code: promo.code,
      percentOff: promo.percentOff,
      amountOffCents: promo.amountOffCents,
    },
  };
}

export function calculateDiscount(
  subtotalCents: number,
  promo: { percentOff: number | null; amountOffCents: number | null }
): number {
  let discount = 0;

  if (promo.percentOff !== null) {
    discount = Math.round(subtotalCents * (promo.percentOff / 100));
  } else if (promo.amountOffCents !== null) {
    discount = promo.amountOffCents;
  }

  // Ensure discount doesn't exceed subtotal (standard policy)
  // Or should it cover delivery fee too? 
  // "amountOffCents" usually implies a fixed cash value off the cart.
  // If I have a $20 coupon and $10 food, do I get free delivery?
  // Let's assume for now it caps at subtotal to prevent negative subtotal, 
  // but if the user wants it to apply to total, I'll need to change this.
  // Given the previous Admin code applied to `baseTotal`, maybe I should allow it to eat into delivery fee?
  // However, `deliveryFeeCents` is often passed to drivers. 
  // Let's cap at subtotal for safety first. 
  // Wait, the ADMIN code did `discountCents = baseTotal`.
  // Let's strictly follow "subtotal" logic for standard coupons to avoid refunding delivery fees which are real costs.
  
  return Math.min(discount, subtotalCents);
}

export async function redeemPromoCode(
  promoCodeId: string,
  userId: string,
  orderId: string | null,
  prisma: PrismaClient
) {
  // Use a transaction to ensure atomicity
  return prisma.$transaction(async (tx) => {
    // 1. Re-check validity (double check for race conditions)
    const promo = await tx.promoCode.findUnique({
      where: { id: promoCodeId },
    });

    if (!promo || !promo.active) {
      throw new Error("Promo code is invalid or inactive");
    }

    if (promo.maxRedemptions !== null && promo.redemptions >= promo.maxRedemptions) {
      throw new Error("Promo code limit reached");
    }

    const existing = await tx.promoRedemption.findUnique({
      where: {
        promoCodeId_userId: {
          promoCodeId: promoCodeId,
          userId: userId,
        },
      },
    });

    if (existing) {
      // If we are retrying/idempotent, we might return existing, but for now throw
      throw new Error("Promo code already redeemed by this user");
    }

    // 2. Create redemption record
    const redemption = await tx.promoRedemption.create({
      data: {
        promoCodeId,
        userId,
        orderId,
      },
    });

    // 3. Increment usage count
    await tx.promoCode.update({
      where: { id: promoCodeId },
      data: {
        redemptions: { increment: 1 },
      },
    });

    return redemption;
  });
}
