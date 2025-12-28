import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getPrisma } from '@/lib/db';
import { MembershipStatus } from '@prisma/client';
import { constructStripeEvent, getStripe } from '@/lib/stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = constructStripeEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const prisma = getPrisma();
  const stripe = getStripe();

  function resolveCurrentPeriodEndDate(
    subscription: Stripe.Subscription,
  ): Date | undefined {
    const currentPeriodEnd = (
      subscription as Stripe.Subscription & { current_period_end?: number }
    ).current_period_end;
    if (typeof currentPeriodEnd !== 'number') return undefined;
    return new Date(currentPeriodEnd * 1000);
  }

  async function findUserIdFromMetadata(metadata?: Stripe.Metadata | null) {
    const userId = metadata?.userId ? String(metadata.userId) : undefined;
    const clerkUserId = metadata?.clerkUserId ? String(metadata.clerkUserId) : undefined;

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) return user.id;
    }
    if (clerkUserId) {
      const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
      if (user) return user.id;
    }
    return undefined;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = await findUserIdFromMetadata(session.metadata);
      if (!userId) {
        return new NextResponse('Webhook Error: No user ID in metadata', { status: 400 });
      }

      const subscriptionId = session.subscription ? String(session.subscription) : undefined;
      const stripeCustomerId = session.customer ? String(session.customer) : undefined;
      const sessionPriceId = session.metadata?.priceId ? String(session.metadata.priceId) : undefined;
      const sessionPlanId = session.metadata?.planId ? String(session.metadata.planId) : undefined;

      let currentPeriodEnd: Date | undefined;
      let priceId = sessionPriceId;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        currentPeriodEnd = resolveCurrentPeriodEndDate(subscription);
        priceId = subscription.items.data[0]?.price?.id ?? priceId;
      }

      await prisma.membershipSubscription.upsert({
        where: { userId },
        update: {
          status: 'ACTIVE',
          stripeCustomerId,
          stripeSubId: subscriptionId,
          ...(priceId ? { stripePriceId: priceId } : {}),
          ...(sessionPlanId ? { planId: sessionPlanId } : {}),
          ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
        },
        create: {
          userId,
          status: 'ACTIVE',
          stripeCustomerId,
          stripeSubId: subscriptionId,
          ...(priceId ? { stripePriceId: priceId } : {}),
          ...(sessionPlanId ? { planId: sessionPlanId } : {}),
          ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
        },
      });
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;

      // Find user by stripeCustomerId if metadata is missing
      let userId: string | undefined = await findUserIdFromMetadata(subscription.metadata);
      if (!userId) {
        const membership = await prisma.membershipSubscription.findFirst({
          where: { stripeCustomerId },
        });
        userId = membership?.userId ?? undefined;
      }

      if (userId) {
        const statusMap: Record<string, MembershipStatus> = {
            'active': 'ACTIVE',
            'past_due': 'PAST_DUE',
            'canceled': 'CANCELED',
            'unpaid': 'PAST_DUE',
            'incomplete': 'TRIALING',
            'incomplete_expired': 'CANCELED',
            'trialing': 'TRIALING',
            'paused': 'INACTIVE'
        };

        const status = statusMap[subscription.status] || 'ACTIVE';
        const priceId = subscription.items.data[0]?.price?.id;
        const planRecord = priceId
          ? await prisma.membershipPlan.findFirst({ where: { stripePriceId: priceId } })
          : null;

        const currentPeriodEnd = resolveCurrentPeriodEndDate(subscription);
        await prisma.membershipSubscription.upsert({
          where: { userId },
          update: {
            status,
            currentPeriodEnd,
            stripeCustomerId,
            stripeSubId: subscription.id,
            ...(priceId ? { stripePriceId: priceId } : {}),
            ...(planRecord?.id ? { planId: planRecord.id } : {}),
          },
          create: {
            userId,
            status,
            currentPeriodEnd,
            stripeCustomerId,
            stripeSubId: subscription.id,
            ...(priceId ? { stripePriceId: priceId } : {}),
            ...(planRecord?.id ? { planId: planRecord.id } : {}),
          },
        });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;
      
      let userId: string | undefined = await findUserIdFromMetadata(subscription.metadata);
      if (!userId) {
        const membership = await prisma.membershipSubscription.findFirst({
          where: { stripeCustomerId }
        });
        userId = membership?.userId ?? undefined;
      }

      if (userId) {
        await prisma.membershipSubscription.upsert({
          where: { userId },
          update: {
            status: 'CANCELED',
            stripeSubId: subscription.id,
            stripeCustomerId,
          },
          create: {
            userId,
            status: 'CANCELED',
            stripeSubId: subscription.id,
            stripeCustomerId,
          },
        });
      }
    }
  } catch (error) {
    console.error('Webhook handler failed', error);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
