import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

const intentSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  couponCode: z.string().optional(),
});

async function ensureBasicMembership(prisma: ReturnType<typeof getPrisma>, userId: string) {
  const existing = await prisma.membershipSubscription.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  const plan =
    (await prisma.membershipPlan.findUnique({ where: { name: "Basic" } })) ??
    (await prisma.membershipPlan.create({ data: { name: "Basic" } }));

  return prisma.membershipSubscription.create({
    data: {
      userId,
      planId: plan.id,
    },
  });
}

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    const clerkUser = await currentUser();
    if (!clerkUserId || !clerkUser) {
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

    // Handle free orders (100% discount) or amounts too small for Stripe
    if (amountCents < 50) {
      return NextResponse.json({
        free: true,
        clientSecret: null,
        message: "Order is free or below minimum payment amount",
      });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: "Missing user email" }, { status: 400 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.upsert({
      where: { clerkId: clerkUserId },
      create: {
        clerkId: clerkUserId,
        email,
        role: "CUSTOMER",
      },
      update: {
        email,
      },
    });

    const stripe = getStripe();

    // Ensure the user has a membership row (older DBs have `planId` NOT NULL)
    const membership = await ensureBasicMembership(prisma, user.id);

    // Get or create Stripe customer
    let stripeCustomerId = membership.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId: user.id,
          clerkId: clerkUserId,
        },
      });
      stripeCustomerId = customer.id;

      // Update user with Stripe customer ID
      await prisma.membershipSubscription.update({
        where: { userId: user.id },
        data: { stripeCustomerId },
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
        clerkId: clerkUserId,
        orderType: "delivery",
        couponCode: couponCode || "",
      },
    };

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: "Stripe did not return a client secret" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      free: false,
    });
  } catch (error) {
    console.error("[CREATE_PAYMENT_INTENT_ERROR]", error);
    const message = error instanceof Error ? error.message : "Failed to create payment intent";
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Failed to create payment intent" : message },
      { status: 500 }
    );
  }
}
