import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { getPrisma } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-11-17.clover',
});

const PLANS = {
  basic: process.env.STRIPE_PRICE_BASIC,
  plus: process.env.STRIPE_PRICE_PLUS,
  executive: process.env.STRIPE_PRICE_EXEC,
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { plan } = await req.json();
    const priceId = PLANS[plan as keyof typeof PLANS];

    if (!priceId) {
      // If basic plan (free), just update DB directly if no stripe price
      if (plan === 'basic') {
         // Handle free tier logic if needed, but for checkout we usually expect a price.
         // If basic is truly $0 and no stripe interaction needed, we might handle it here.
         // But the prompt says "Creates Stripe Checkout Session".
         // If priceId is missing, return error.
         return new NextResponse('Plan not found or configured', { status: 400 });
      }
      return new NextResponse('Plan not found', { status: 400 });
    }

    const prisma = getPrisma();
    
    // Check if user already has a stripe customer ID
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { membership: true },
    });

    if (!dbUser) {
        return new NextResponse('User not found in DB', { status: 404 });
    }

    let stripeCustomerId = dbUser.membership?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.emailAddresses[0].emailAddress,
        metadata: {
          clerkUserId: userId,
          userId: dbUser.id,
        },
      });
      stripeCustomerId = customer.id;
      
      // Update user with stripe customer id
      // We upsert membership to ensure it exists
      await prisma.membershipSubscription.upsert({
        where: { userId: dbUser.id },
        update: { stripeCustomerId },
        create: {
            userId: dbUser.id,
            stripeCustomerId,
            status: 'INACTIVE', // Will be active after webhook
        }
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        clerkUserId: userId,
        userId: dbUser.id,
        planCode: plan,
      },
      subscription_data: {
        metadata: {
          userId: dbUser.id,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE_CHECKOUT]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
