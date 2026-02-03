'use server';

import { getNeonSession } from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { redirect } from 'next/navigation';

export async function createCheckoutSession(planCode: 'BASIC' | 'PLUS' | 'PRO' | 'ELITE' | 'BLACK') {
  const neonSession = await getNeonSession();
  // @ts-ignore
  const userId = neonSession?.userId || neonSession?.user?.id;
  
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const prisma = getPrisma();
  
  // 1. Get user from DB
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { membership: true },
  });

  if (!user) {
    // Sync user from Neon Session (replaces Clerk sync)
    // @ts-ignore
    const neonUser = neonSession?.user || {};
    const email = neonUser.email;
    
    if (!email) throw new Error('No email found in session');

    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email,
        name: neonUser.name || email,
        role: 'CUSTOMER',
      },
      include: { membership: true },
    });
  }

  // 2. Get or create Stripe Customer
  let stripeCustomerId = user.membership?.stripeCustomerId;

  if (!stripeCustomerId) {
    const stripe = getStripe();
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: {
        userId: user.id,
        clerkId: userId,
      },
    });
    stripeCustomerId = customer.id;

    // Save customer ID immediately to prevent duplicates
    if (user.membership) {
        await prisma.membershipSubscription.update({
            where: { id: user.membership.id },
            data: { stripeCustomerId },
        });
    } else {
        // Membership records are created via webhook; checkout uses the customer ID directly.
    }
  }

  // 3. Select Price ID
  let priceId = '';
  switch (planCode) {
    case 'BASIC':
      priceId = process.env.STRIPE_PRICE_BASIC!;
      break;
    case 'PLUS':
      priceId = process.env.STRIPE_PRICE_PLUS!;
      break;
    case 'PRO':
      priceId = process.env.STRIPE_PRICE_PRO!;
      break;
    case 'ELITE':
      priceId = process.env.STRIPE_PRICE_ELITE!;
      break;
    case 'BLACK':
      priceId = process.env.STRIPE_PRICE_BLACK!;
      break;
  }

  if (!priceId) {
    throw new Error(`Price ID not found for plan: ${planCode}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // 4. Create Checkout Session
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    ...(user.role === 'ADMIN'
      ? {
          allow_promotion_codes: true,
          payment_method_collection: 'if_required',
        }
      : {}),
    success_url: `${appUrl}/membership/manage?success=1`,
    cancel_url: `${appUrl}/membership?canceled=1`,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      clerkId: userId,
      planCode,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        clerkId: userId,
      },
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  redirect(session.url);
}

export async function createCustomerPortal() {
    const neonSession = await getNeonSession();
    // @ts-ignore
    const userId = neonSession?.userId || neonSession?.user?.id;

    if (!userId) throw new Error('Unauthorized');

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: { membership: true },
    });

    if (!user?.membership?.stripeCustomerId) {
        throw new Error('No billing account found');
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
        customer: user.membership.stripeCustomerId,
        return_url: `${appUrl}/membership/manage`,
    });

    redirect(session.url);
}
