import { NextResponse } from "next/server";
import { getNeonSession } from "@/lib/auth/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const neonSession = await getNeonSession();
    // @ts-ignore
    const userId = neonSession?.userId || neonSession?.user?.id;
    
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return new NextResponse("Invalid session", { status: 400 });
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
    return new NextResponse("Internal Error", { status: 500 });
  }
}
