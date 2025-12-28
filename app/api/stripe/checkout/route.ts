import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

const PLAN_PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC,
  plus: process.env.STRIPE_PRICE_PLUS,
  executive: process.env.STRIPE_PRICE_EXEC,
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { planId, priceId, plan } = await req.json();
    const prisma = getPrisma();

    let resolvedPriceId: string | undefined = priceId;
    let resolvedPlanId: string | undefined;

    if (!resolvedPriceId && planId) {
      const planRecord = await prisma.membershipPlan.findUnique({
        where: { id: planId },
      });
      resolvedPriceId = planRecord?.stripePriceId ?? undefined;
      resolvedPlanId = planRecord?.id ?? undefined;
    }

    if (!resolvedPriceId && plan) {
      resolvedPriceId = PLAN_PRICE_IDS[plan as keyof typeof PLAN_PRICE_IDS];

      if (!resolvedPriceId) {
        const planRecord = await prisma.membershipPlan.findFirst({
          where: { name: { equals: String(plan), mode: 'insensitive' } },
        });
        resolvedPriceId = planRecord?.stripePriceId ?? undefined;
        resolvedPlanId = planRecord?.id ?? undefined;
      }
    }

    if (!resolvedPlanId && resolvedPriceId) {
      const planRecord = await prisma.membershipPlan.findFirst({
        where: { stripePriceId: resolvedPriceId },
      });
      resolvedPlanId = planRecord?.id ?? undefined;
    }

    if (!resolvedPriceId) {
      return new NextResponse('Plan not found or configured', { status: 400 });
    }
    
    // Check if user already has a stripe customer ID
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { membership: true },
    });

    if (!dbUser) {
        return new NextResponse('User not found in DB', { status: 404 });
    }

    let stripeCustomerId = dbUser.membership?.stripeCustomerId;

    const stripe = getStripe();

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.emailAddresses[0].emailAddress,
        metadata: {
          clerkUserId: userId,
          userId: dbUser.id,
        },
      });
      stripeCustomerId = customer.id;
      
      // Update user with stripe customer id
      // We upsert membership to ensure it exists
      await prisma.membershipSubscription.upsert({
        where: { userId: dbUser.id },
        update: {
          stripeCustomerId,
          ...(resolvedPlanId ? { planId: resolvedPlanId } : {}),
          ...(resolvedPriceId ? { stripePriceId: resolvedPriceId } : {}),
        },
        create: {
            userId: dbUser.id,
            stripeCustomerId,
            ...(resolvedPlanId ? { planId: resolvedPlanId } : {}),
            ...(resolvedPriceId ? { stripePriceId: resolvedPriceId } : {}),
            status: 'INACTIVE', // Will be active after webhook
        }
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: resolvedPriceId,
          quantity: 1,
        },
      ],
      metadata: {
        clerkUserId: userId,
        userId: dbUser.id,
        planId: resolvedPlanId ?? '',
        priceId: resolvedPriceId,
      },
      subscription_data: {
        metadata: {
          userId: dbUser.id,
          clerkUserId: userId,
        },
      },
      success_url: `${appUrl}/billing?success=true`,
      cancel_url: `${appUrl}/billing?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE_CHECKOUT]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
