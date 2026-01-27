import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Prisma, ServiceMilesTransactionType } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { constructStripeEvent, getStripe } from '@/lib/stripe';
import { calculateMonthlyMilesRollover, UNLIMITED_SERVICE_MILES } from '../../../../lib/membership-miles';

export const runtime = 'nodejs';

type MembershipStatus = 
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'TRIALING'
  | 'INACTIVE';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = constructStripeEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed.`, message);
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  const prisma = getPrisma();
  const stripe = getStripe();

  const statusMap: Record<string, MembershipStatus> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'PAST_DUE',
    incomplete: 'TRIALING',
    incomplete_expired: 'CANCELED',
    trialing: 'TRIALING',
    paused: 'INACTIVE',
  };

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

  async function upsertMembershipFromStripeSubscription(subscription: Stripe.Subscription) {
    const stripeCustomerId = subscription.customer as string;

    let userId: string | undefined = await findUserIdFromMetadata(subscription.metadata);
    if (!userId) {
      const membership = await prisma.membershipSubscription.findFirst({
        where: { stripeCustomerId },
      });
      userId = membership?.userId ?? undefined;
    }
    if (!userId) return;

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

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.purpose === 'order_payment') {
        const userId = await findUserIdFromMetadata(session.metadata);
        if (userId) {
          // Attempt to find and update the draft order
          const draft = await prisma.deliveryRequest.findFirst({
            where: { 
              userId, 
              deliveryCheckoutSessionId: session.id 
            }
          });
          
          if (draft) {
             await prisma.deliveryRequest.update({
               where: { id: draft.id },
               data: { deliveryFeePaid: true }
             });
          }
        }
        return new NextResponse(null, { status: 200 });
      }

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
    } else if (event.type === 'customer.subscription.created') {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertMembershipFromStripeSubscription(subscription);
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertMembershipFromStripeSubscription(subscription);
    } else if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscriptionField = (invoice as any).subscription;
      const subscriptionId = typeof subscriptionField === 'string' 
        ? subscriptionField 
        : subscriptionField?.id;

      if (!subscriptionId) {
        return new NextResponse(null, { status: 200 }); // One-time invoice? Ignore for now
      }

      // 1. Identify User & Plan
      const membership = await prisma.membershipSubscription.findFirst({
        where: { stripeSubId: subscriptionId },
        include: {
          user: {
            include: { serviceMilesWallet: true }
          },
          plan: true
        }
      });

      if (!membership || !membership.user) {
         console.warn(`[Stripe Webhook] Invoice paid but no linked membership found for sub ${subscriptionId}`);
         return new NextResponse(null, { status: 200 });
      }

      const user = membership.user;
      let plan = membership.plan;
      if (!plan && membership.stripePriceId) {
        plan = await prisma.membershipPlan.findFirst({ where: { stripePriceId: membership.stripePriceId } });
      }
      if (!plan) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;
        if (priceId) {
          plan = await prisma.membershipPlan.findFirst({ where: { stripePriceId: priceId } });
          if (plan) {
            await prisma.membershipSubscription.update({
              where: { id: membership.id },
              data: { planId: plan.id, stripePriceId: priceId },
            });
          }
        }
      }
      if (!plan) return new NextResponse(null, { status: 200 });

      await prisma.$transaction(async (tx) => {
        // Refresh wallet in transaction to lock
        let wallet = await tx.serviceMilesWallet.findUnique({ where: { userId: user.id } });
        
        if (!wallet) {
            wallet = await tx.serviceMilesWallet.create({ data: { userId: user.id } });
        }

        const invoiceId = invoice.id;
        const idempotencyKeyBase = `stripe_invoice:${invoiceId}`;
        const rollInKey = `${idempotencyKeyBase}:ROLL_IN`;
        const alreadyProcessed = await tx.serviceMilesLedger.findFirst({
          where: {
            walletId: wallet.id,
            idempotencyKey: rollInKey,
          },
          select: { id: true },
        });
        if (alreadyProcessed) return;

        const currentBalance = wallet.balanceMiles;
        const rolloverCap = plan.rolloverCapMiles;
        const monthlyGrant = plan.monthlyServiceMiles;

        const { rolloverBank, expiredMiles, newBalance } = calculateMonthlyMilesRollover({
          currentBalance,
          rolloverCap,
          monthlyGrant,
        });

        try {
          await tx.serviceMilesLedger.create({
            data: {
              walletId: wallet.id,
              amount: 0,
              transactionType: ServiceMilesTransactionType.ROLL_IN,
              idempotencyKey: rollInKey,
              description: `${rollInKey} rolled=${rolloverBank}`,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return;
          }
          throw error;
        }
        
        const isUnlimited = newBalance === UNLIMITED_SERVICE_MILES;

        // A. Expire old miles (if any)
        if (!isUnlimited && expiredMiles > 0) {
            await tx.serviceMilesLedger.create({
                data: {
                    walletId: wallet.id,
                    amount: -expiredMiles,
                    transactionType: ServiceMilesTransactionType.EXPIRE,
                    idempotencyKey: `${idempotencyKeyBase}:EXPIRE`,
                    description: `${idempotencyKeyBase}:EXPIRE cap=${rolloverCap}`,
                }
            });
        }

        // C. Add Monthly Grant
        if (!isUnlimited && monthlyGrant > 0) {
            await tx.serviceMilesLedger.create({
                data: {
                    walletId: wallet.id,
                    amount: monthlyGrant,
                    transactionType: ServiceMilesTransactionType.ADD_MONTHLY,
                    idempotencyKey: `${idempotencyKeyBase}:ADD_MONTHLY`,
                    description: `${idempotencyKeyBase}:ADD_MONTHLY plan=${plan.name}`,
                }
            });
        }

        // D. Update Wallet Balance
        await tx.serviceMilesWallet.update({
            where: { id: wallet.id },
            data: {
                balanceMiles: newBalance,
                rolloverBankMiles: rolloverBank === UNLIMITED_SERVICE_MILES ? 0 : rolloverBank // Update bank tracker
            }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
