'use server';

import {
  extractNeonAuthEmail,
  extractNeonAuthUserId,
  getNeonSession,
} from '@/lib/auth/server';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

const DEFAULT_PORTAL_RETURN_PATH = '/membership/manage';

async function resolveAppUrlFromRequestHeaders(): Promise<string> {
  const headerList = await headers();
  const origin = headerList.get('origin');
  if (origin) return origin;

  const forwardedHost = headerList.get('x-forwarded-host') ?? headerList.get('host');
  if (!forwardedHost) return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const forwardedProto = headerList.get('x-forwarded-proto');
  const proto = forwardedProto === 'http' ? 'http' : 'https';
  return `${proto}://${forwardedHost}`;
}

async function resolveSafeReturnPathFromRequestHeaders(
  fallback: string = DEFAULT_PORTAL_RETURN_PATH
): Promise<string> {
  const headerList = await headers();
  const referer = headerList.get('referer');
  if (!referer) return fallback;

  const appUrl = await resolveAppUrlFromRequestHeaders();

  try {
    const appOrigin = new URL(appUrl).origin;
    const refererUrl = new URL(referer);

    if (refererUrl.origin !== appOrigin) {
      return fallback;
    }

    const returnPath = `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`;
    return returnPath || fallback;
  } catch {
    return fallback;
  }
}

export async function createCheckoutSession(planCode: 'BASIC' | 'PLUS' | 'PRO' | 'ELITE' | 'BLACK') {
  const neonSession = await getNeonSession();
  const userId = extractNeonAuthUserId(neonSession);
  
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const prisma = getPrisma();
  
  // 1. Get user from DB
  let user = await prisma.user.findUnique({
    where: { neonAuthId: userId },
    include: { membership: true },
  });

  if (!user) {
    // Sync user from Neon Session
    const neonUser =
      ((neonSession as { user?: { name?: string } } | null)?.user ?? {});
    const email = extractNeonAuthEmail(neonSession);
    
    if (!email) throw new Error('No email found in session');

    user = await prisma.user.create({
      data: {
        neonAuthId: userId,
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
        neonAuthId: userId,
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

  const appUrl = await resolveAppUrlFromRequestHeaders();

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
      neonAuthId: userId,
      planCode,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        neonAuthId: userId,
      },
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  redirect(session.url);
}

export async function createCustomerPortal() {
  const returnPath = await resolveSafeReturnPathFromRequestHeaders();
  const neonSession = await getNeonSession();
  const userId = extractNeonAuthUserId(neonSession);

  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`);
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { neonAuthId: userId },
    include: { membership: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const stripe = getStripe();
  let stripeCustomerId = user.membership?.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: {
        userId: user.id,
        neonAuthId: userId,
      },
    });

    stripeCustomerId = customer.id;

    await prisma.membershipSubscription.upsert({
      where: { userId: user.id },
      update: {
        stripeCustomerId,
      },
      create: {
        userId: user.id,
        stripeCustomerId,
        status: 'INACTIVE',
      },
    });
  }

  const appUrl = await resolveAppUrlFromRequestHeaders();

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}${returnPath}`,
  });

  redirect(session.url);
}
