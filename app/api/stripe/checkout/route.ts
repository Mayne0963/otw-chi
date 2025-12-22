import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

const PLAN_PRICES = {
  BASIC: process.env.STRIPE_PRICE_BASIC,
  PLUS: process.env.STRIPE_PRICE_PLUS,
  EXECUTIVE: process.env.STRIPE_PRICE_EXEC,
};

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { plan } = body;

    if (!plan || !['BASIC', 'PLUS', 'EXECUTIVE'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const priceId = PLAN_PRICES[plan as keyof typeof PLAN_PRICES];
    if (!priceId) {
      return NextResponse.json({ error: 'Price configuration missing' }, { status: 500 });
    }

    const prisma = getPrisma();
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { membership: true },
    });

    if (!user) {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      
      if (!email) {
        return NextResponse.json({ error: 'User email not found' }, { status: 400 });
      }

      user = await prisma.user.create({
        data: {
          clerkId: userId,
          email,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
          role: 'CUSTOMER',
        },
        include: { membership: true },
      });
    }

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

      // We'll let the webhook handle the DB update for membership creation,
      // but if we had a place to store stripeCustomerId on User, we would do it here.
      // For now, we proceed.
    }

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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pricing?canceled=true`,
      metadata: {
        clerkUserId: userId,
        plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
