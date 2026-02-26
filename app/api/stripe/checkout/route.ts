import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { extractNeonAuthEmail, extractNeonAuthUserId, getNeonSession } from '@/lib/auth/server';

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

function isStripeInvalidRequestError(error: unknown): boolean {
  const maybeStripeError = error as { type?: string } | undefined;
  return maybeStripeError?.type === 'StripeInvalidRequestError';
}

export async function POST(req: Request) {
  try {
    const sessionData = await getNeonSession();
    const neonAuthUserId = extractNeonAuthUserId(sessionData);
    if (!neonAuthUserId) {
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
    const email = extractNeonAuthEmail(sessionData);
    const sessionUser = ((sessionData as { user?: { name?: string } } | null)?.user ?? {});

    const planRecordById = planId
      ? await prisma.membershipPlan.findUnique({
          where: { id: planId },
        })
      : null;
    const planRecordByCode = plan
      ? await prisma.membershipPlan.findFirst({
          where: { name: { equals: PLAN_NAME_BY_CODE[plan], mode: 'insensitive' } },
        })
      : null;

    let resolvedPlanId: string | undefined = planRecordById?.id ?? planRecordByCode?.id ?? undefined;

    const candidatePriceIds = new Set<string>();
    const addCandidatePriceId = (value?: string | null) => {
      if (!value) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      candidatePriceIds.add(trimmed);
    };

    addCandidatePriceId(priceId);
    addCandidatePriceId(planRecordById?.stripePriceId);
    addCandidatePriceId(planRecordByCode?.stripePriceId);
    if (plan) {
      addCandidatePriceId(PLAN_PRICE_IDS[plan as keyof typeof PLAN_PRICE_IDS]);
    }

    if (!resolvedPlanId && priceId) {
      const planRecord = await prisma.membershipPlan.findFirst({
        where: { stripePriceId: priceId },
      });
      resolvedPlanId = planRecord?.id ?? undefined;
    }

    if (candidatePriceIds.size === 0) {
      return NextResponse.json(
        {
          error: 'Checkout is not configured for this plan',
          code: 'CHECKOUT_PRICE_NOT_CONFIGURED',
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    let resolvedPriceId: string | undefined;
    for (const candidatePriceId of candidatePriceIds) {
      try {
        const candidatePrice = await stripe.prices.retrieve(candidatePriceId);
        if (!candidatePrice.active) continue;
        if (candidatePrice.type !== 'recurring' || !candidatePrice.recurring) continue;
        resolvedPriceId = candidatePrice.id;
        break;
      } catch (error) {
        if (isStripeInvalidRequestError(error)) continue;
        throw error;
      }
    }

    if (!resolvedPriceId) {
      console.error('[STRIPE_CHECKOUT_PRICE_LOOKUP_FAILED]', {
        plan,
        planId,
        candidatePriceIds: Array.from(candidatePriceIds),
      });
      return NextResponse.json(
        {
          error: 'Plan checkout is temporarily unavailable. Please contact support.',
          code: 'CHECKOUT_PRICE_INVALID',
        },
        { status: 400 }
      );
    }

    let dbUser = await prisma.user.findUnique({
      where: { neonAuthId: neonAuthUserId },
      include: { membership: true },
    });

    if (!dbUser) {
      if (!email) {
        return NextResponse.json({ error: 'Missing user email' }, { status: 400 });
      }

      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { membership: true },
      });

      if (existingUser) {
        dbUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            neonAuthId: neonAuthUserId,
            email,
            ...(sessionUser.name ? { name: sessionUser.name } : {}),
          },
          include: { membership: true },
        });
      } else {
        const createdUser = await prisma.user.create({
          data: {
            neonAuthId: neonAuthUserId,
            email,
            name: sessionUser.name || email.split('@')[0] || 'User',
            role: 'CUSTOMER',
          },
          include: { membership: true },
        });
        dbUser = createdUser;
        prisma.customerProfile.create({ data: { userId: createdUser.id } }).catch(console.error);
      }
    }

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in DB' }, { status: 404 });
    }

    let stripeCustomerId = dbUser.membership?.stripeCustomerId;

    if (!stripeCustomerId) {
      if (!dbUser.email) {
        return NextResponse.json({ error: 'Missing user email' }, { status: 400 });
      }
      const customer = await stripe.customers.create({
        email: dbUser.email,
        metadata: {
          userId: dbUser.id,
          neonAuthUserId: dbUser.neonAuthId,
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

    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        // Let Stripe skip card entry when 100% discounts reduce checkout due to $0.
        payment_method_collection: 'if_required',
        ...(dbUser.role === 'ADMIN' ? { allow_promotion_codes: true } : {}),
        line_items: [
          {
            price: resolvedPriceId,
            quantity: 1,
          },
        ],
        metadata: {
          neonAuthUserId,
          userId: dbUser.id,
          planId: resolvedPlanId ?? '',
          planCode: plan ?? '',
          planName: plan ? PLAN_NAME_BY_CODE[plan] : '',
          priceId: resolvedPriceId,
        },
        subscription_data: {
          metadata: {
            userId: dbUser.id,
            neonAuthUserId,
            planCode: plan ?? '',
            planName: plan ? PLAN_NAME_BY_CODE[plan] : '',
          },
        },
        success_url: `${appUrl}/membership/manage?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/membership/manage?canceled=1`,
      });
    } catch (error) {
      console.error('[STRIPE_CHECKOUT_CREATE_SESSION]', error);
      const maybeStripeError = error as { type?: string; message?: string; code?: string };
      const isInvalidRequest = isStripeInvalidRequestError(error);
      const message = maybeStripeError?.message || 'Failed to create checkout session';
      return NextResponse.json(
        {
          error: isInvalidRequest
            ? 'Checkout could not be started for this plan. Please contact support.'
            : message,
          code: isInvalidRequest ? maybeStripeError?.code || 'STRIPE_INVALID_REQUEST' : 'STRIPE_CHECKOUT_FAILED',
        },
        { status: isInvalidRequest ? 400 : 500 }
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('[STRIPE_CHECKOUT]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'production' ? 'Internal Error' : message },
      { status: 500 }
    );
  }
}
