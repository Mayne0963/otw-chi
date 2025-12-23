import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getPrisma } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: NextRequest) {
  try {
    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const payload = await req.text();
    const secret = process.env.STRIPE_WEBHOOK_SECRET as string;
    if (!secret) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, sig, secret);
    } catch (_err) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkUserId = String(session.metadata?.clerkUserId || '');
      const plan = String(session.metadata?.plan || '').toUpperCase();
      const stripeCustomerId = String(session.customer || '');
      const stripeSubscriptionId = String(session.subscription || '');
      const priceId = String((session.line_items as any)?.data?.[0]?.price?.id || session.metadata?.priceId || '');

      const prisma = getPrisma();

      const dbUser = await prisma.user.findFirst({ where: { clerkId: clerkUserId } });
      if (!dbUser) {
        return NextResponse.json({ ok: true });
      }

      const planName =
        plan === 'PLUS' ? 'Plus' :
        plan === 'EXECUTIVE' ? 'Executive' :
        'Basic';

      let dbPlan = await prisma.membershipPlan.findFirst({ where: { name: planName } });
      if (!dbPlan) {
        dbPlan = await prisma.membershipPlan.create({
          data: { name: planName, stripePriceId: priceId || null }
        });
      }

      await prisma.membershipSubscription.upsert({
        where: { userId: dbUser.id },
        update: {
          planId: dbPlan.id,
          status: 'ACTIVE',
          stripeCustomerId,
          stripeSubId: stripeSubscriptionId,
          stripePriceId: priceId || dbPlan.stripePriceId || null,
        },
        create: {
          userId: dbUser.id,
          planId: dbPlan.id,
          status: 'ACTIVE',
          stripeCustomerId,
          stripeSubId: stripeSubscriptionId,
          stripePriceId: priceId || dbPlan.stripePriceId || null,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
