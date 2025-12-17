'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { redirect } from 'next/navigation';

export async function createCheckoutSession(planCode: 'BASIC' | 'PLUS' | 'EXEC') {
  const { userId } = await auth();
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
    // Should be synced by webhook/middleware, but safe fallback
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    
    if (!email) throw new Error('No email found');

    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email,
        name: `${clerkUser.firstName} ${clerkUser.lastName}`.trim(),
        role: 'CUSTOMER',
      },
      include: { membership: true },
    });
  }

  // 2. Get or create Stripe Customer
  let stripeCustomerId = user.membership?.stripeCustomerId;

  if (!stripeCustomerId) {
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
        // Create placeholder membership to store customer ID
        // We need a planId, assume there's a default "FREE" plan or handle this differently
        // For now, we'll upsert when the subscription webhook comes in.
        // BUT, we need to store the customer ID. 
        // Let's create a subscription record with NO plan/status just to hold the ID? 
        // Or better, just pass it to checkout and let webhook handle DB creation.
        // Actually, we should probably add stripeCustomerId to User model for easier access, 
        // but instructions say MembershipSubscription.
        
        // Let's rely on webhook to create the DB record if it doesn't exist, 
        // but we pass the ID to checkout.
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
    case 'EXEC':
      priceId = process.env.STRIPE_PRICE_EXEC!;
      break;
  }

  if (!priceId) {
    throw new Error(`Price ID not found for plan: ${planCode}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // 4. Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
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
    const { userId } = await auth();
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

    const session = await stripe.billingPortal.sessions.create({
        customer: user.membership.stripeCustomerId,
        return_url: `${appUrl}/membership/manage`,
    });

    redirect(session.url);
}
