import { NextResponse } from "next/server";
import { extractNeonAuthUserId, getNeonSession } from "@/lib/auth/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const neonSession = await getNeonSession();
    const userId = extractNeonAuthUserId(neonSession);
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    if (
      (session.metadata?.neonAuthUserId && session.metadata.neonAuthUserId !== userId) ||
      session.metadata?.purpose !== "order_payment"
    ) {
      return NextResponse.json({ paid: false }, { status: 200 });
    }

    return NextResponse.json({
      paid: true,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      metadata: session.metadata ?? null,
    });
  } catch (error) {
    console.error("[STRIPE_DELIVERY_VERIFY]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
