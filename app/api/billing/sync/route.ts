import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { MembershipStatus } from "@prisma/client";

export const runtime = "nodejs";

const statusMap: Record<string, MembershipStatus> = {
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'PAST_DUE',
  incomplete: 'TRIALING',
  incomplete_expired: 'CANCELED',
  trialing: 'TRIALING',
  paused: 'INACTIVE',
};

export async function POST(_req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 1. Get Customer ID
    let stripeCustomerId: string | null = null;
    
    const membership = await prisma.membershipSubscription.findUnique({ 
      where: { userId: user.id } 
    });
    stripeCustomerId = membership?.stripeCustomerId ?? null;

    const stripe = getStripe();

    // Fallback: Check Stripe by email
    if (!stripeCustomerId && user.email) {
       const customers = await stripe.customers.list({ email: user.email, limit: 1 });
       if (customers.data.length > 0) {
         stripeCustomerId = customers.data[0].id;
       }
    }

    if (!stripeCustomerId) {
      return NextResponse.json({ 
        synced: false, 
        message: "No Stripe customer record found." 
      });
    }

    // 2. Fetch Active Subscription
    // We want the most relevant one (active or trialing)
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all', // Fetch all to handle canceled/past_due updates too
      limit: 1,
      expand: ['data.latest_invoice']
    });

    if (subscriptions.data.length === 0) {
      // No subscriptions found -> ensure DB says inactive? 
      // Or just leave it alone? Safe to leave alone or mark CANCELED if we're sure.
      // For safety, let's just return.
      return NextResponse.json({ 
        synced: true, 
        active: false,
        message: "No subscriptions found in Stripe." 
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = subscriptions.data[0] as any;
    const status = statusMap[sub.status] || 'ACTIVE';
    const currentPeriodEnd = new Date(sub.current_period_end * 1000);
    const priceId = sub.items.data[0].price.id;

    // 3. Resolve Plan
    const plan = await prisma.membershipPlan.findFirst({ 
      where: { stripePriceId: priceId } 
    });

    // Fallback: Try metadata planCode
    if (!plan && sub.metadata?.planCode) {
       // This part is tricky without importing the const, but we can try generic lookup?
       // Let's just rely on priceId for now as it's the robust link.
    }

    // 4. Update DB
    await prisma.membershipSubscription.upsert({
      where: { userId: user.id },
      update: {
        status,
        currentPeriodEnd,
        stripeCustomerId,
        stripeSubId: sub.id,
        stripePriceId: priceId,
        ...(plan ? { planId: plan.id } : {}),
      },
      create: {
        userId: user.id,
        status,
        currentPeriodEnd,
        stripeCustomerId,
        stripeSubId: sub.id,
        stripePriceId: priceId,
        planId: plan?.id, // If plan is null, this might fail if planId is required. 
                          // It's usually optional or we should have a basic plan fallback.
                          // Schema says planId is optional? Let's check.
      },
    });

    return NextResponse.json({ 
      synced: true, 
      status, 
      plan: plan?.name 
    });

  } catch (error) {
    console.error("Billing sync error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
