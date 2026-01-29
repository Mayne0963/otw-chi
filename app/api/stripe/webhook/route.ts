/* eslint-disable no-console */
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { MembershipStatus } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { constructStripeEvent, getStripe } from '@/lib/stripe';
import { redeemPromoCode } from '@/lib/promo-code';
import { activateMembershipAtomically } from '@/lib/membership-activation';

export const runtime = 'nodejs';

const PLAN_NAME_BY_CODE = {
  basic: 'OTW BASIC',
  plus: 'OTW PLUS',
  pro: 'OTW PRO',
  elite: 'OTW ELITE',
  black: 'OTW BLACK',
} as const;

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

  async function resolveSubscriptionContext(subscription: Stripe.Subscription, knownSession?: Stripe.Checkout.Session) {
    const stripeCustomerId = subscription.customer as string;
    let userId: string | undefined = await findUserIdFromMetadata(knownSession?.metadata || subscription.metadata);

    // 1. Resolve User
    if (!userId) {
      const membership = await prisma.membershipSubscription.findFirst({
        where: { stripeCustomerId },
      });
      userId = membership?.userId ?? undefined;
    }

    // Prepare plan variables
    let planCode = subscription.metadata?.planCode ? String(subscription.metadata.planCode) : undefined;
    let planName = subscription.metadata?.planName ? String(subscription.metadata.planName) : undefined;

    // Use known session metadata if available
    if (knownSession?.metadata) {
       if (!planCode) planCode = knownSession.metadata.planCode ? String(knownSession.metadata.planCode) : undefined;
       if (!planName) planName = knownSession.metadata.planName ? String(knownSession.metadata.planName) : undefined;
    }

    // FALLBACK: If userId or plan info is missing, fetch Checkout Session (if not provided)
    if ((!userId || (!planCode && !planName)) && !knownSession) {
      console.log(`[Stripe Webhook] Missing userId or plan metadata. Attempting to fetch Checkout Session for sub ${subscription.id}...`);
      try {
        const sessions = await stripe.checkout.sessions.list({ subscription: subscription.id, limit: 1 });
        const session = sessions.data[0];
        if (session?.metadata) {
           console.log(`[Stripe Webhook] Found Checkout Session ${session.id}. Checking metadata...`, session.metadata);
           
           if (!userId) {
             userId = await findUserIdFromMetadata(session.metadata);
             if (userId) console.log(`[Stripe Webhook] Recovered userId ${userId} from session metadata.`);
           }

           if (!planCode) planCode = session.metadata.planCode ? String(session.metadata.planCode) : undefined;
           if (!planName) planName = session.metadata.planName ? String(session.metadata.planName) : undefined;
        }
      } catch (err) {
        console.error(`[Stripe Webhook] Failed to fetch checkout sessions:`, err);
      }
    }

    if (!userId) {
        console.warn(`[Stripe Webhook] CRITICAL: Could not resolve userId for subscription ${subscription.id}`);
        return null;
    }

    // 2. Resolve Plan
    const status = statusMap[subscription.status] || 'ACTIVE';
    const priceId = subscription.items.data[0]?.price?.id;
    
    let planRecord = priceId
      ? await prisma.membershipPlan.findFirst({ where: { stripePriceId: priceId } })
      : null;
    
    if (!planRecord) {
      console.log(`[Stripe Webhook] Plan not found by priceId ${priceId}. Trying metadata...`);
      
      const nameFromCode =
        planCode && planCode in PLAN_NAME_BY_CODE
          ? PLAN_NAME_BY_CODE[planCode as keyof typeof PLAN_NAME_BY_CODE]
          : undefined;
      
      const resolvedName = nameFromCode || planName;
      
      if (resolvedName) {
        console.log(`[Stripe Webhook] Found plan name: ${resolvedName}`);
        planRecord = await prisma.membershipPlan.findFirst({
          where: { name: { equals: resolvedName, mode: 'insensitive' } },
        });
      }
    }

    if (!planRecord) {
        console.warn(`[Stripe Webhook] CRITICAL: Could not resolve plan for subscription ${subscription.id}. Price: ${priceId}, Metadata:`, subscription.metadata);
    } else {
        console.log(`[Stripe Webhook] Resolved plan: ${planRecord.name} (ID: ${planRecord.id})`);
    }

    const currentPeriodEnd = resolveCurrentPeriodEndDate(subscription);

    return {
      userId,
      status,
      priceId,
      planRecord,
      currentPeriodEnd,
      stripeCustomerId
    };
  }

  async function upsertMembershipFromStripeSubscription(subscription: Stripe.Subscription) {
    const context = await resolveSubscriptionContext(subscription);
    if (!context) return;

    let invoiceId = typeof subscription.latest_invoice === 'string' 
      ? subscription.latest_invoice 
      : subscription.latest_invoice?.id;

    // If we have an invoice and a resolved plan, use atomic activation to ensure consistency
    if (invoiceId && context.planRecord) {
        console.log(`[Stripe Webhook] Delegating subscription update to atomic activation (Invoice: ${invoiceId})`);
        await activateMembershipAtomically({
            ...context,
            planRecord: context.planRecord,
            invoiceId,
            subscriptionId: subscription.id
        });
        return;
    }

    const { userId, status, priceId, planRecord, currentPeriodEnd, stripeCustomerId } = context;

    console.log(`[Stripe Webhook] Manual upsert for sub ${subscription.id} (No invoice or plan record). Status: ${status}`);

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
             const couponCode = session.metadata.couponCode || null;
             const discountCents = session.metadata.discountCents ? parseInt(session.metadata.discountCents) : null;
             const promoCodeId = session.metadata.promoCodeId || null;

             await prisma.deliveryRequest.update({
               where: { id: draft.id },
               data: { 
                 deliveryFeePaid: true,
                 ...(couponCode ? { couponCode } : {}),
                 ...(discountCents !== null ? { discountCents } : {})
               }
             });

             if (promoCodeId) {
               try {
                 await redeemPromoCode(promoCodeId, userId, draft.id, prisma);
                 console.log(`[Stripe Webhook] Redeemed promo code ${promoCodeId} for user ${userId} order ${draft.id}`);
               } catch (err) {
                 // Ignore "already redeemed" errors for idempotency
                 console.log(`[Stripe Webhook] Promo redemption note: ${err instanceof Error ? err.message : 'Unknown'}`);
               }
             }
          }
        }
        return new NextResponse(null, { status: 200 });
      }

      const userId = await findUserIdFromMetadata(session.metadata);
      if (!userId) {
        return new NextResponse('Webhook Error: No user ID in metadata', { status: 400 });
      }

      const subscriptionId = session.subscription ? String(session.subscription) : undefined;
      
      if (subscriptionId) {
        // Expand latest_invoice to ensure we have the ID for idempotency
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
        const context = await resolveSubscriptionContext(subscription, session);

        if (context && context.planRecord) {
            let invoiceId = typeof session.invoice === 'string' ? session.invoice : undefined;
            if (!invoiceId && subscription.latest_invoice) {
                invoiceId = typeof subscription.latest_invoice === 'string' 
                  ? subscription.latest_invoice 
                  : subscription.latest_invoice.id;
            }

            // Only activate if paid
            if (session.payment_status === 'paid' && invoiceId) {
                console.log(`[Stripe Webhook] atomic activation via Checkout Session for sub ${subscriptionId}`);
                await activateMembershipAtomically({
                    ...context,
                    planRecord: context.planRecord,
                    invoiceId,
                    subscriptionId
                });
            } else {
                console.warn(`[Stripe Webhook] Session ${session.id} not paid or no invoice. Status: ${session.payment_status}`);
            }
        } else {
            console.warn(`[Stripe Webhook] Context invalid or plan missing for session ${session.id}. Skipping activation.`);
        }
      } else {
        console.warn(`[Stripe Webhook] Checkout session ${session.id} missing subscription ID. Skipping membership activation.`);
      }
    } else if (event.type === 'customer.subscription.created') {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertMembershipFromStripeSubscription(subscription);
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertMembershipFromStripeSubscription(subscription);
    } else if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscriptionField = (invoice as any).subscription;
      const subscriptionId = typeof subscriptionField === 'string' 
        ? subscriptionField 
        : subscriptionField?.id;

      if (!subscriptionId) {
        return new NextResponse(null, { status: 200 }); // One-time invoice? Ignore for now
      }

      // 1. Resolve Context (Outside Transaction)
      // We fetch the subscription to get the latest status and period
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const context = await resolveSubscriptionContext(subscription);
      
      if (!context) {
          console.warn(`[Stripe Webhook] Invoice paid but context resolution failed for sub ${subscriptionId}`);
          return new NextResponse(null, { status: 200 });
      }

      const { userId, status, priceId, planRecord, currentPeriodEnd, stripeCustomerId } = context;

      if (!planRecord) {
         console.warn(`[Stripe Webhook] Invoice paid but no plan resolved for sub ${subscriptionId}`);
         return new NextResponse(null, { status: 200 });
      }

      console.log(`[Stripe Webhook] Processing atomic activation for user ${userId}, plan ${planRecord.name}`);

      // 2. Atomic Transaction via Shared Helper
      // This handles:
      // - Upserting MembershipSubscription
      // - Updating User (stripeCustomerId)
      // - Granting Miles (idempotently via invoiceId)
      // - Setting Status to ACTIVE (or whatever Stripe says, usually active if paid)
      try {
        await activateMembershipAtomically({
          userId,
          subscriptionId,
          stripeCustomerId,
          status, // Ideally 'ACTIVE' if payment succeeded
          currentPeriodEnd,
          priceId,
          planRecord,
          invoiceId: invoice.id, // CRITICAL: Used for ledger idempotency (externalRef)
        });
      } catch (err) {
        console.error(`[Stripe Webhook] Atomic activation failed for sub ${subscriptionId}:`, err);
        // We throw so Stripe retries (unless it's a known non-retryable error)
        throw err;
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
