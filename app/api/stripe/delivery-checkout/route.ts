import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { getPrisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { deliveryFeeCents } = await req.json();
    if (!Number.isInteger(deliveryFeeCents) || deliveryFeeCents <= 0) {
      return new NextResponse("Invalid delivery fee", { status: 400 });
    }

    const prisma = getPrisma();
    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) {
      return new NextResponse("User not found", { status: 404 });
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: {
          clerkUserId: userId,
          userId: dbUser.id,
          purpose: "delivery_fee",
        },
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "OTW Delivery Fee",
            },
            unit_amount: deliveryFeeCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        clerkUserId: userId,
        userId: dbUser.id,
        purpose: "delivery_fee",
        deliveryFeeCents: String(deliveryFeeCents),
      },
      success_url: `${appUrl}/order?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/order?checkout=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[STRIPE_DELIVERY_CHECKOUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
