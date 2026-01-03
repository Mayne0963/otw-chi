import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { getPrisma } from "@/lib/db";
import { calculateDiscount, findActiveCoupon, normalizeCouponCode } from "@/lib/coupons";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { deliveryFeeCents, subtotalCents, couponCode } = await req.json();
    if (!Number.isInteger(deliveryFeeCents) || deliveryFeeCents <= 0) {
      return NextResponse.json({ error: "Invalid delivery fee" }, { status: 400 });
    }
    if (!Number.isInteger(subtotalCents) || subtotalCents < 0) {
      return NextResponse.json({ error: "Invalid subtotal" }, { status: 400 });
    }

    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const baseTotal = deliveryFeeCents + subtotalCents;
    if (baseTotal <= 0) {
      return NextResponse.json({ error: "Invalid total" }, { status: 400 });
    }

    let discountCents = 0;
    let resolvedCouponCode: string | undefined;
    let allowPromotionCodes = true;
    let stripeDiscounts:
      | Array<{ promotion_code: string }>
      | undefined;
    let couponSource: "internal" | "stripe" | "" = "";

    if (couponCode) {
      const normalized = normalizeCouponCode(couponCode);
      const couponResult = await findActiveCoupon(prisma, normalized, dbUser.id);
      if (couponResult) {
        discountCents = calculateDiscount(
          { subtotalCents, deliveryFeeCents },
          couponResult.coupon
        );
        if (discountCents <= 0) {
          return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
        }
        resolvedCouponCode = couponResult.coupon.code;
        allowPromotionCodes = false;
        couponSource = "internal";
      } else {
        const promoCodes = await stripe.promotionCodes.list({
          code: normalized,
          active: true,
          limit: 1,
        });
        const promo = promoCodes.data[0];
        if (promo) {
          stripeDiscounts = [{ promotion_code: promo.id }];
          resolvedCouponCode = normalized;
          allowPromotionCodes = false;
          couponSource = "stripe";
        } else {
          return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
        }
      }
    }

    const finalTotal = Math.max(0, baseTotal - discountCents);
    if (finalTotal < 50) {
      return NextResponse.json({ error: "Total must be at least $0.50" }, { status: 400 });
    }

    const customerEmail = user.emailAddresses[0]?.emailAddress;
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      ...(allowPromotionCodes ? { allow_promotion_codes: true } : {}),
      ...(stripeDiscounts ? { discounts: stripeDiscounts } : {}),
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: {
          clerkUserId: userId,
          userId: dbUser.id,
          purpose: "order_payment",
          deliveryFeeCents: String(deliveryFeeCents),
          subtotalCents: String(subtotalCents),
          couponCode: resolvedCouponCode ?? "",
          discountCents: String(discountCents),
          couponSource,
        },
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "OTW Order Total",
            },
            unit_amount: finalTotal,
          },
          quantity: 1,
        },
      ],
      metadata: {
        clerkUserId: userId,
        userId: dbUser.id,
        purpose: "order_payment",
        deliveryFeeCents: String(deliveryFeeCents),
        subtotalCents: String(subtotalCents),
        couponCode: resolvedCouponCode ?? "",
        discountCents: String(discountCents),
        couponSource,
      },
      success_url: `${appUrl}/order?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/order?checkout=cancel`,
    };

    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
      sessionParams.customer_creation = "always";
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[STRIPE_DELIVERY_CHECKOUT]", error);
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
