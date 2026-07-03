import { NextResponse } from "next/server";
import { extractNeonAuthUserId, getNeonSession } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { OverageBillingMode, OverageStatus } from "@prisma/client";
import { redeemPromoCode } from "@/lib/promo-code";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const neonSession = await getNeonSession();
    const neonAuthUserId = extractNeonAuthUserId(neonSession);
    
    if (!neonAuthUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { neonAuthId: neonAuthUserId },
      select: {
        id: true,
        neonAuthId: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
      return NextResponse.json({ paid: false }, { status: 200 });
    }

    if (session.metadata?.purpose !== "order_payment") {
      return NextResponse.json({ paid: false }, { status: 200 });
    }

    const requestSelect = {
      id: true,
      userId: true,
      overageBillingMode: true,
      overageStatus: true,
      overageMiles: true,
      overageCents: true,
    } as const;

    const metadataRequestId = session.metadata?.deliveryRequestId
      ? String(session.metadata.deliveryRequestId)
      : null;
    const clientReferenceRequestId = session.client_reference_id
      ? String(session.client_reference_id)
      : null;

    let request = metadataRequestId
      ? await prisma.deliveryRequest.findUnique({
          where: { id: metadataRequestId },
          select: requestSelect,
        })
      : null;

    if (!request && clientReferenceRequestId && clientReferenceRequestId !== metadataRequestId) {
      request = await prisma.deliveryRequest.findUnique({
        where: { id: clientReferenceRequestId },
        select: requestSelect,
      });
    }

    if (!request) {
      request = await prisma.deliveryRequest.findFirst({
        where: { deliveryCheckoutSessionId: session.id },
        select: requestSelect,
      });
    }

    if (!request) {
      return NextResponse.json({
        paid: true,
        synced: false,
        reason: "request_not_found",
        amountTotal: session.amount_total ?? null,
        currency: session.currency ?? null,
        metadata: session.metadata ?? null,
      });
    }

    const isOwner = request.userId === user.id;
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ paid: false }, { status: 200 });
    }

    const parsedMetadataDiscountCents = session.metadata?.discountCents
      ? Number.parseInt(session.metadata.discountCents, 10)
      : NaN;
    const metadataDiscountCents =
      Number.isFinite(parsedMetadataDiscountCents) && parsedMetadataDiscountCents > 0
        ? parsedMetadataDiscountCents
        : null;
    const checkoutDiscountCents = session.total_details?.amount_discount ?? 0;
    const discountCents =
      metadataDiscountCents !== null
        ? metadataDiscountCents
        : checkoutDiscountCents > 0
          ? checkoutDiscountCents
          : null;
    const couponCode = session.metadata?.couponCode || null;
    const promoCodeId = session.metadata?.promoCodeId || null;

    await prisma.deliveryRequest.update({
      where: { id: request.id },
      data: {
        deliveryFeePaid: true,
        paymentRequired:
          request.overageBillingMode === OverageBillingMode.INSTANT &&
          request.overageStatus !== OverageStatus.PAID &&
          request.overageMiles > 0 &&
          (request.overageCents ?? 0) > 0,
        ...(couponCode ? { couponCode } : {}),
        ...(discountCents !== null ? { discountCents } : {}),
      },
    });

    if (promoCodeId) {
      try {
        await redeemPromoCode(promoCodeId, request.userId, request.id, prisma);
      } catch (error) {
        console.warn(
          "[STRIPE_DELIVERY_VERIFY] Promo redemption note:",
          error instanceof Error ? error.message : "Unknown",
        );
      }
    }

    return NextResponse.json({
      paid: true,
      synced: true,
      requestId: request.id,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      metadata: session.metadata ?? null,
    });
  } catch (error) {
    console.error("[STRIPE_DELIVERY_VERIFY]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
