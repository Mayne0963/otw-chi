import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { getCurrentUser } from '@/lib/auth/roles';

export const runtime = 'nodejs';

const PLAN_PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC,
  plus: process.env.STRIPE_PRICE_PLUS,
  pro: process.env.STRIPE_PRICE_PRO,
  elite: process.env.STRIPE_PRICE_ELITE,
  black: process.env.STRIPE_PRICE_BLACK,
};

const PLAN_NAME_BY_CODE = {
  basic: 'OTW BASIC',
  plus: 'OTW PLUS',
  pro: 'OTW PRO',
  elite: 'OTW ELITE',
  black: 'OTW BLACK',
} as const;

const checkoutSchema = z
  .object({
    planId: z.string().min(1).optional(),
    priceId: z.string().min(1).optional(),
    plan: z.enum(['basic', 'plus', 'pro', 'elite', 'black']).optional(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { planId, priceId, plan } = parsed.data;
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

    if (plan) {
      const planRecord = await prisma.membershipPlan.findFirst({
        where: { name: { equals: PLAN_NAME_BY_CODE[plan], mode: 'insensitive' } },
      });
      resolvedPlanId = resolvedPlanId ?? (planRecord?.id ?? undefined);

      if (!resolvedPriceId) {
        resolvedPriceId = PLAN_PRICE_IDS[plan as keyof typeof PLAN_PRICE_IDS] ?? undefined;
      }
      if (!resolvedPriceId) {
        resolvedPriceId = planRecord?.stripePriceId ?? undefined;
      }
    }

    if (!resolvedPlanId && resolvedPriceId) {
      const planRecord = await prisma.membershipPlan.findFirst({
        where: { stripePriceId: resolvedPriceId },
      });
      resolvedPlanId = planRecord?.id ?? undefined;
    }

    if (!resolvedPriceId) {
      return NextResponse.json({ error: 'Plan not found or configured' }, { status: 400 });
    }
    
    // Check if user already has a stripe customer ID
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { membership: true },
    });

    if (!dbUser) {
        return NextResponse.json({ error: 'User not found in DB' }, { status: 404 });
    }

    let stripeCustomerId = dbUser.membership?.stripeCustomerId;

    const stripe = getStripe();

    if (!stripeCustomerId) {
      if (!dbUser.email) {
        return NextResponse.json({ error: 'Missing user email' }, { status: 400 });
      }
      const customer = await stripe.customers.create({
        email: dbUser.email,
        metadata: {
          userId: dbUser.id,
          clerkUserId: dbUser.clerkId,
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

    const origin = req.headers.get('origin');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin || 'http://localhost:3000';

    const clerkUserId = dbUser.clerkId;

    let session;
    try {
      session = await stripe.checkout.sessions.create({
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
          clerkUserId,
          userId: dbUser.id,
          planId: resolvedPlanId ?? '',
          planCode: plan ?? '',
          planName: plan ? PLAN_NAME_BY_CODE[plan] : '',
          priceId: resolvedPriceId,
        },
        subscription_data: {
          metadata: {
            userId: dbUser.id,
            clerkUserId,
            planCode: plan ?? '',
            planName: plan ? PLAN_NAME_BY_CODE[plan] : '',
          },
        },
        success_url: `${appUrl}/billing?success=true`,
        cancel_url: `${appUrl}/billing?canceled=true`,
      });
    } catch (error) {
      console.error('[STRIPE_CHECKOUT_CREATE_SESSION]', error);
      const maybeStripeError = error as { type?: string; message?: string };
      const isInvalidRequest = maybeStripeError?.type === 'StripeInvalidRequestError';
      const message =
        process.env.NODE_ENV === 'production'
          ? 'Failed to create checkout session'
          : maybeStripeError?.message || 'Failed to create checkout session';
      return NextResponse.json(
        { error: message },
        { status: isInvalidRequest ? 400 : 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE_CHECKOUT]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'production' ? 'Internal Error' : message },
      { status: 500 }
    );
  }
}
