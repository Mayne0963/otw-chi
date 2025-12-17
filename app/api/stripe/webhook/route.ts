import { constructStripeEvent, getStripe } from '@/lib/stripe';
import { getPrisma } from '@/lib/db';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret missing' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = constructStripeEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const prisma = getPrisma();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
          await handleSubscriptionChange(session, prisma);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription, prisma);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Webhook handler failed:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionChange(session: Stripe.Checkout.Session, prisma: any) {
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;
  const userId = session.metadata?.userId || session.client_reference_id;

  if (!userId) {
    console.error('No userId found in session metadata');
    return;
  }

  // Retrieve full subscription details to get status and price
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await handleSubscriptionUpdate(subscription, prisma, userId);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription, prisma: any, explicitUserId?: string) {
  const stripeCustomerId = subscription.customer as string;
  const stripePriceId = subscription.items.data[0]?.price.id;
  const status = subscription.status;
  // @ts-ignore
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  // Map Stripe status to our Enum
  let dbStatus = 'ACTIVE';
  if (status === 'past_due' || status === 'unpaid') dbStatus = 'PAST_DUE';
  else if (status === 'canceled') dbStatus = 'CANCELED';
  else if (status === 'trialing') dbStatus = 'TRIALING';
  else if (status === 'active') dbStatus = 'ACTIVE';
  else dbStatus = 'INACTIVE';

  // Find user
  let userId = explicitUserId || subscription.metadata?.userId;
  
  if (!userId) {
    // Try to find via customer ID if we already have it linked
    const existingSub = await prisma.membershipSubscription.findFirst({
        where: { stripeCustomerId }
    });
    if (existingSub) {
        userId = existingSub.userId;
    }
  }

  if (!userId) {
    console.error(`Could not find User for Stripe Customer ${stripeCustomerId}`);
    return;
  }

  // Determine Plan ID from Price ID (We need to look up our Plan table)
  // Assumes we have seeded Plans with stripePriceId
  let plan = await prisma.membershipPlan.findFirst({
    where: { stripePriceId }
  });

  if (!plan) {
    // Fallback: Try to map known env vars if DB isn't seeded with IDs yet
    if (stripePriceId === process.env.STRIPE_PRICE_BASIC) plan = await prisma.membershipPlan.findUnique({ where: { name: 'Basic' } });
    else if (stripePriceId === process.env.STRIPE_PRICE_PLUS) plan = await prisma.membershipPlan.findUnique({ where: { name: 'Plus' } });
    else if (stripePriceId === process.env.STRIPE_PRICE_EXEC) plan = await prisma.membershipPlan.findUnique({ where: { name: 'Executive' } });
  }

  if (!plan) {
      console.error(`Unknown plan for price ${stripePriceId}`);
      return; 
  }

  await prisma.membershipSubscription.upsert({
    where: { userId },
    create: {
      userId,
      planId: plan.id,
      stripeCustomerId,
      stripeSubId: subscription.id,
      stripePriceId,
      status: dbStatus,
      currentPeriodEnd,
    },
    update: {
      planId: plan.id, // Update plan if they switched
      stripeCustomerId, // Ensure this is set
      stripeSubId: subscription.id,
      stripePriceId,
      status: dbStatus,
      currentPeriodEnd,
    },
  });
}
