import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getPrisma } from '@/lib/db';
import { MembershipStatus } from '@/lib/generated/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const prisma = getPrisma();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (!session?.metadata?.userId) {
        return new NextResponse('Webhook Error: No user ID in metadata', { status: 400 });
      }

      const subscriptionId = session.subscription as string;
      
      await prisma.membershipSubscription.update({
        where: { userId: session.metadata.userId },
        data: {
          stripeSubId: subscriptionId,
          stripePriceId: session.metadata.planCode, // Store plan code or price ID
          status: 'ACTIVE',
        },
      });
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;

      // Find user by stripeCustomerId if metadata is missing
      let userId: string | undefined = subscription.metadata?.userId;
      if (!userId) {
        const membership = await prisma.membershipSubscription.findFirst({
            where: { stripeCustomerId }
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

        await prisma.membershipSubscription.update({
            where: { userId },
            data: {
                status,
                currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
                stripePriceId: subscription.items.data[0].price.id,
            }
        });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;
      
      let userId: string | undefined = subscription.metadata?.userId;
      if (!userId) {
        const membership = await prisma.membershipSubscription.findFirst({
            where: { stripeCustomerId }
        });
        userId = membership?.userId ?? undefined;
      }

      if (userId) {
        await prisma.membershipSubscription.update({
            where: { userId },
            data: {
                status: 'CANCELED',
            }
        });
      }
    }
  } catch (error) {
    console.error('Webhook handler failed', error);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
