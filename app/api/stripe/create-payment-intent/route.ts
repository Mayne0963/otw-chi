import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { getPrisma } from "@/lib/db";

const intentSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  couponCode: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = intentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { amountCents, couponCode } = parsed.data;

    // Handle free orders (100% discount)
    if (amountCents === 0) {
      return NextResponse.json({
        free: true,
        clientSecret: null,
        message: "Order is free, no payment required",
      });
    }

    // Validate minimum amount for Stripe
    if (amountCents < 50) {
      return NextResponse.json(
        { error: "Amount must be at least $0.50" },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stripe = getStripe();

    // Get or create Stripe customer
    let stripeCustomerId = user.membership?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          userId: user.id,
          clerkId: userId,
        },
      });
      stripeCustomerId = customer.id;

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: user.id },
        data: {
          membership: {
            upsert: {
              create: { stripeCustomerId },
              update: { stripeCustomerId },
            },
          },
        },
      });
    }

    // Create Payment Intent
    const paymentIntentParams: any = {
      amount: amountCents,
      currency: "usd",
      customer: stripeCustomerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: user.id,
        clerkId: userId,
        orderType: "delivery",
        couponCode: couponCode || "",
      },
    };

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      free: false,
    });
  } catch (error) {
    console.error("[CREATE_PAYMENT_INTENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
