import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { OverageBillingMode, OverageStatus } from "@prisma/client";
import { extractNeonAuthEmail, extractNeonAuthUserId, getNeonSession } from "@/lib/auth/server";
import { getStripe } from "@/lib/stripe";
import { getPrisma } from "@/lib/db";
import { ADMIN_FREE_COUPON_CODE, isAdminFreeCoupon } from "@/lib/admin-discount";
import { validatePromoCode, calculateDiscount, redeemPromoCode } from "@/lib/promo-code";
import { shouldRequireDeliveryFeePayment } from "@/lib/delivery-payment";

export const runtime = "nodejs";

function resolveRequestOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (origin) return origin;

  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!forwardedHost) return null;

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto = forwardedProto === "http" ? "http" : "https";
  return `${proto}://${forwardedHost}`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readInteger(value: unknown): number | undefined {
  return Number.isInteger(value) ? Number(value) : undefined;
}

function hasOutstandingInstantOverage(request: {
  overageBillingMode: OverageBillingMode | null;
  overageStatus: OverageStatus;
  overageMiles: number;
  overageCents: number | null;
}): boolean {
  const overageCents = Number.isFinite(request.overageCents)
    ? Math.max(0, Math.round(Number(request.overageCents)))
    : 0;

  return (
    request.overageBillingMode === OverageBillingMode.INSTANT &&
    request.overageStatus !== OverageStatus.PAID &&
    request.overageMiles > 0 &&
    overageCents > 0
  );
}

export async function POST(req: Request) {
  try {
    const neonSession = await getNeonSession();
    const userId = extractNeonAuthUserId(neonSession);
    const userEmail = extractNeonAuthEmail(neonSession);

    if (!userId || !userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { neonAuthId: userId } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const deliveryRequestId = readString(body.deliveryRequestId);
    const requestedCouponCode = readString(body.couponCode);
    const successPath = readString(body.successPath);
    const cancelPath = readString(body.cancelPath);

    let deliveryRequest:
      | {
          id: string;
          userId: string;
          deliveryFeeCents: number | null;
          deliveryFeePaid: boolean;
          paymentRequired: boolean;
          overageBillingMode: OverageBillingMode | null;
          overageStatus: OverageStatus;
          overageMiles: number;
          overageCents: number | null;
        }
      | null = null;

    let deliveryFeeCents = readInteger(body.deliveryFeeCents);
    let subtotalCents = readInteger(body.subtotalCents);
    let tipCents = readInteger(body.tipCents) ?? 0;

    if (deliveryRequestId) {
      deliveryRequest = await prisma.deliveryRequest.findUnique({
        where: { id: deliveryRequestId },
        select: {
          id: true,
          userId: true,
          deliveryFeeCents: true,
          deliveryFeePaid: true,
          paymentRequired: true,
          overageBillingMode: true,
          overageStatus: true,
          overageMiles: true,
          overageCents: true,
        },
      });

      if (!deliveryRequest) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }

      const isOwner = deliveryRequest.userId === dbUser.id;
      const isAdmin = dbUser.role === "ADMIN";
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (deliveryRequest.deliveryFeePaid) {
        return NextResponse.json({
          alreadyPaid: true,
          url: `${resolveRequestOrigin(req) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/request/${deliveryRequest.id}`,
        });
      }

      const requiresPayment =
        deliveryRequest.paymentRequired ||
        shouldRequireDeliveryFeePayment({
          deliveryFeeCents: deliveryRequest.deliveryFeeCents,
          deliveryFeePaid: deliveryRequest.deliveryFeePaid,
          billingMode: deliveryRequest.overageBillingMode,
        });

      if (!requiresPayment) {
        return NextResponse.json(
          { error: "Delivery fee payment is not required for this request" },
          { status: 409 },
        );
      }

      deliveryFeeCents = Number.isFinite(deliveryRequest.deliveryFeeCents)
        ? Math.max(0, Math.round(Number(deliveryRequest.deliveryFeeCents)))
        : 0;
      subtotalCents = 0;
      tipCents = 0;
    }

    if (typeof deliveryFeeCents !== "number" || !Number.isInteger(deliveryFeeCents) || deliveryFeeCents <= 0) {
      return NextResponse.json({ error: "Invalid delivery fee" }, { status: 400 });
    }
    if (typeof subtotalCents !== "number" || !Number.isInteger(subtotalCents) || subtotalCents < 0) {
      return NextResponse.json({ error: "Invalid subtotal" }, { status: 400 });
    }
    if (!Number.isInteger(tipCents) || tipCents < 0) {
      return NextResponse.json({ error: "Invalid tip" }, { status: 400 });
    }

    const checkedDeliveryFeeCents = deliveryFeeCents as number;
    const checkedSubtotalCents = subtotalCents as number;
    const checkedTipCents = tipCents;

    const stripe = getStripe();
    const appUrl = resolveRequestOrigin(req) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const baseTotal = checkedDeliveryFeeCents + checkedSubtotalCents + checkedTipCents;
    if (baseTotal <= 0) {
      return NextResponse.json({ error: "Invalid total" }, { status: 400 });
    }

    let discountCents = 0;
    let resolvedCouponCode: string | undefined;
    let stripeDiscounts: Array<{ promotion_code: string }> | undefined;
    let couponSource: "internal" | "stripe" | "" = "";
    let promoCodeId: string | undefined;

    if (requestedCouponCode) {
      // 1. Check Legacy Admin Coupon
      if (isAdminFreeCoupon(requestedCouponCode)) {
        if (dbUser.role !== "ADMIN") {
           return NextResponse.json({ error: "Forbidden: Admin coupon used by non-admin" }, { status: 403 });
        }
        discountCents = baseTotal; // 100% off total
        resolvedCouponCode = ADMIN_FREE_COUPON_CODE;
        couponSource = "internal";
      } else {
        // 2. Check Database Promo Code
        const validation = await validatePromoCode(requestedCouponCode, dbUser.id, prisma);
        if (validation.valid) {
          const discountableCents = deliveryRequest ? baseTotal : checkedSubtotalCents;
          discountCents = calculateDiscount(discountableCents, validation.promoCode);
          resolvedCouponCode = validation.promoCode.code;
          promoCodeId = validation.promoCode.id;
          couponSource = "internal";
        } else {
          // 3. Fallback to Stripe Promotion Codes so dashboard coupon entry
          // can accept Stripe-native codes consistently.
          const stripePromotionCodes = await stripe.promotionCodes.list({
            code: requestedCouponCode,
            active: true,
            limit: 5,
          });

          const matchedPromotionCode = stripePromotionCodes.data.find(
            (promotionCode) =>
              promotionCode.code.toUpperCase() === requestedCouponCode.toUpperCase(),
          );

          if (!matchedPromotionCode) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
          }

          resolvedCouponCode = matchedPromotionCode.code;
          stripeDiscounts = [{ promotion_code: matchedPromotionCode.id }];
          couponSource = "stripe";
        }
      }
    }

    const finalTotal = Math.max(0, baseTotal - discountCents);
    
    // Handle 100% discount - no payment needed, bypass Stripe
    if (finalTotal === 0) {
      console.warn("[STRIPE_DELIVERY_CHECKOUT] 100% discount applied, bypassing Stripe");
      
      // If it's a DB promo code, redeem it now
      if (promoCodeId) {
        try {
          await redeemPromoCode(promoCodeId, dbUser.id, deliveryRequestId || null, prisma);
        } catch (err) {
          console.error("Failed to redeem promo code for free order:", err);
          return NextResponse.json({ error: "Failed to process promo code redemption" }, { status: 500 });
        }
      }

      if (deliveryRequest) {
        await prisma.deliveryRequest.update({
          where: { id: deliveryRequest.id },
          data: {
            deliveryFeePaid: true,
            paymentRequired: hasOutstandingInstantOverage(deliveryRequest),
            couponCode: resolvedCouponCode ?? null,
            discountCents,
          },
        });
      }

      return NextResponse.json({ 
        url: deliveryRequest
          ? `${appUrl}${successPath || `/request/${deliveryRequest.id}?checkout=success&free=true`}`
          : `${appUrl}${successPath || "/order?checkout=success&free=true"}`,
        free: true,
        couponCode: resolvedCouponCode,
        discountCents,
        metadata: {
          neonAuthUserId: userId,
          userId: dbUser.id,
          purpose: "order_payment",
          deliveryFeeCents: String(checkedDeliveryFeeCents),
          subtotalCents: String(checkedSubtotalCents),
          tipCents: String(checkedTipCents),
          couponCode: resolvedCouponCode ?? "",
          discountCents: String(discountCents),
          couponSource,
          free: "true",
          promoCodeId: promoCodeId ?? "",
          deliveryRequestId: deliveryRequest?.id ?? deliveryRequestId ?? ""
        }
      });
    }
    
    // Stripe requires minimum $0.50 for payment sessions
    if (finalTotal < 50) {
      return NextResponse.json({ error: "Total must be at least $0.50" }, { status: 400 });
    }

    const customerEmail = userEmail;
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      ...(!resolvedCouponCode ? { allow_promotion_codes: true } : {}),
      ...(stripeDiscounts ? { discounts: stripeDiscounts } : {}),
      ...(deliveryRequest ? { client_reference_id: deliveryRequest.id } : {}),
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: {
          neonAuthUserId: userId,
          userId: dbUser.id,
          purpose: "order_payment",
          deliveryFeeCents: String(checkedDeliveryFeeCents),
          subtotalCents: String(checkedSubtotalCents),
          tipCents: String(checkedTipCents),
          couponCode: resolvedCouponCode ?? "",
          discountCents: String(discountCents),
          couponSource,
          promoCodeId: promoCodeId ?? "",
          deliveryRequestId: deliveryRequest?.id ?? deliveryRequestId ?? ""
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
        neonAuthUserId: userId,
        userId: dbUser.id,
        purpose: "order_payment",
        deliveryFeeCents: String(checkedDeliveryFeeCents),
        subtotalCents: String(checkedSubtotalCents),
        tipCents: String(checkedTipCents),
        couponCode: resolvedCouponCode ?? "",
        discountCents: String(discountCents),
        couponSource,
        promoCodeId: promoCodeId ?? "",
        deliveryRequestId: deliveryRequest?.id ?? deliveryRequestId ?? ""
      },
      success_url: deliveryRequest
        ? `${appUrl}${successPath || `/request/${deliveryRequest.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`}`
        : `${appUrl}${successPath || "/order?checkout=success&session_id={CHECKOUT_SESSION_ID}"}`,
      cancel_url: deliveryRequest
        ? `${appUrl}${cancelPath || `/pay/${deliveryRequest.id}?checkout=cancel`}`
        : `${appUrl}${cancelPath || "/order?checkout=cancel"}`,
    };

    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
      sessionParams.customer_creation = "always";
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (deliveryRequest) {
      await prisma.deliveryRequest.update({
        where: { id: deliveryRequest.id },
        data: {
          deliveryCheckoutSessionId: session.id,
        },
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[STRIPE_DELIVERY_CHECKOUT]", error);
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
