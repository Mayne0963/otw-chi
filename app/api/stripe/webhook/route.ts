import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook secret missing' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  const prisma = getPrisma();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const clerkUserId = session.metadata?.clerkUserId;
    const planCode = session.metadata?.plan;
    const stripeCustomerId = session.customer as string;
    const stripeSubscriptionId = session.subscription as string;

    if (!clerkUserId || !planCode) {
      console.error('Missing metadata in checkout session');
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
    if (!user) {
      console.error(`User not found for clerkId: ${clerkUserId}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Map plan code to Plan ID (assuming Plan names in DB match logic or we upsert them)
    // We'll search by name or create if missing to be safe, though ideally seeded.
    let planName = 'Basic';
    if (planCode === 'PLUS') planName = 'Plus';
    if (planCode === 'EXECUTIVE') planName = 'Executive';

    let plan = await prisma.membershipPlan.findUnique({ where: { name: planName } });
    if (!plan) {
      // Create if doesn't exist (fallback)
      plan = await prisma.membershipPlan.create({ data: { name: planName } });
    }

    // Upsert Subscription
    await prisma.membershipSubscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        planId: plan.id,
        stripeCustomerId,
        stripeSubId: stripeSubscriptionId,
        status: 'ACTIVE',
        // We could fetch subscription details for currentPeriodEnd, 
        // but for now we'll just set it active.
      },
      update: {
        planId: plan.id,
        stripeCustomerId,
        stripeSubId: stripeSubscriptionId,
        status: 'ACTIVE',
      },
    });
  }

  // Handle other events like invoice.payment_succeeded to update period end
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.subscription as string;

    const sub = await prisma.membershipSubscription.findFirst({
      where: { stripeSubId: subscriptionId },
    });

    if (sub) {
      await prisma.membershipSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: new Date(invoice.lines.data[0].period.end * 1000),
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
