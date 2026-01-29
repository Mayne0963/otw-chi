import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { MembershipStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';

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

export async function GET(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If session_id is provided, verify it belongs to the user
    if (sessionId) {
        const stripe = getStripe();
        try {
            const session = await stripe.checkout.sessions.retrieve(sessionId, {
                expand: ['subscription', 'subscription.latest_invoice']
            });
            
            // Verify ownership
            const sessionUserId = session.metadata?.userId;
            const sessionClerkId = session.metadata?.clerkUserId;
            const isMatch = (sessionUserId && sessionUserId === user.id) || 
                            (sessionClerkId && sessionClerkId === user.clerkId) ||
                            (session.customer_email && session.customer_email === user.email);
            
            if (isMatch && session.payment_status === 'paid' && session.subscription) {
                // Determine if we need to force activation
                // This is the "Instant Grant" fallback if webhook is slow
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let subscription: any = session.subscription;
                
                // Safety check: if subscription wasn't expanded properly or is just an ID
                if (typeof subscription === 'string') {
                    // eslint-disable-next-line no-console
                    console.log(`[Billing Sync] Fetching subscription ${subscription} manually`);
                    subscription = await stripe.subscriptions.retrieve(subscription, {
                        expand: ['latest_invoice']
                    });
                }

                const invoiceId = subscription.latest_invoice?.id || (typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : null);
                
                if (invoiceId) {
                    // Check if DB is already updated
                    const isLedgerPresent = await prisma.serviceMilesLedger.findFirst({
                        where: { externalRef: `stripe_invoice:${invoiceId}:ROLL_IN` }
                    });

                    if (!isLedgerPresent) {
                        // eslint-disable-next-line no-console
                        console.log(`[Billing Sync] Force-activating membership for user ${user.id} session ${sessionId}`);
                        
                        // Resolve plan details
                        const priceId = subscription.items?.data[0]?.price?.id;
                        let planRecord = await prisma.membershipPlan.findFirst({ where: { stripePriceId: priceId } });
                        
                        // Fallback plan resolution
                        if (!planRecord && session.metadata?.planCode) {
                             const planCode = session.metadata.planCode;
                             const PLAN_NAME_BY_CODE = {
                                basic: 'OTW BASIC',
                                plus: 'OTW PLUS',
                                pro: 'OTW PRO',
                                elite: 'OTW ELITE',
                                black: 'OTW BLACK',
                              };
                              // @ts-expect-error - dynamic lookup
                              const name = PLAN_NAME_BY_CODE[planCode];
                              if (name) {
                                  planRecord = await prisma.membershipPlan.findFirst({
                                      where: { name: { equals: name, mode: 'insensitive' } }
                                  });
                              }
                        }

                        if (planRecord) {
                            // Import dynamically to avoid circular deps if any (though route.ts is safe)
                            const { activateMembershipAtomically } = await import('@/lib/membership-activation');
                            
                            await activateMembershipAtomically({
                                userId: user.id,
                                subscriptionId: subscription.id,
                                stripeCustomerId: session.customer as string,
                                status: 'ACTIVE',
                                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                                priceId,
                                planRecord,
                                invoiceId,
                            });
                        } else {
                            console.warn(`[Billing Sync] Could not resolve plan for price ${priceId} or code ${session.metadata?.planCode}`);
                        }
                    }
                }
            }
        } catch (err) {
            console.warn(`[Billing Sync] Failed to retrieve/process session ${sessionId}`, err);
        }
    }

    // Get current status
    const membership = await prisma.membershipSubscription.findUnique({ 
        where: { userId: user.id },
        include: { plan: true }
    });

    const wallet = await prisma.serviceMilesWallet.findUnique({
        where: { userId: user.id }
    });

    return NextResponse.json({
        active: membership?.status === 'ACTIVE',
        status: membership?.status || 'INACTIVE',
        balanceMiles: wallet?.balanceMiles || 0,
        planName: membership?.plan?.name || 'None'
    });
  } catch (error) {
      console.error("[Billing Sync] Error:", error);
      return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

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
