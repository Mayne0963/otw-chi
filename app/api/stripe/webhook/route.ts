import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Prisma, ServiceMilesTransactionType } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { constructStripeEvent, getStripe } from '@/lib/stripe';
import { calculateMonthlyMilesRollover, UNLIMITED_SERVICE_MILES } from '../../../../lib/membership-miles';
import { redeemPromoCode } from '@/lib/promo-code';

export const runtime = 'nodejs';

type MembershipStatus = 
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'TRIALING'
  | 'INACTIVE';

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

  async function upsertMembershipFromStripeSubscription(subscription: Stripe.Subscription) {
    const stripeCustomerId = subscription.customer as string;

    let userId: string | undefined = await findUserIdFromMetadata(subscription.metadata);
    if (!userId) {
      const membership = await prisma.membershipSubscription.findFirst({
        where: { stripeCustomerId },
      });
      userId = membership?.userId ?? undefined;
    }

    // Prepare plan variables
    let planCode = subscription.metadata?.planCode ? String(subscription.metadata.planCode) : undefined;
    let planName = subscription.metadata?.planName ? String(subscription.metadata.planName) : undefined;

    // FALLBACK: If userId or plan info is missing, fetch Checkout Session
    if (!userId || (!planCode && !planName)) {
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
        return;
    }

    const status = statusMap[subscription.status] || 'ACTIVE';
    const priceId = subscription.items.data[0]?.price?.id;
    
    console.log(`[Stripe Webhook] Upserting membership for sub ${subscription.id}. Status: ${status}, Price: ${priceId}`);

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
      const stripeCustomerId = session.customer ? String(session.customer) : undefined;
      const sessionPriceId = session.metadata?.priceId ? String(session.metadata.priceId) : undefined;
      const sessionPlanId = session.metadata?.planId ? String(session.metadata.planId) : undefined;
      const sessionPlanCode = session.metadata?.planCode ? String(session.metadata.planCode) : undefined;
      const sessionPlanName = session.metadata?.planName ? String(session.metadata.planName) : undefined;

      let currentPeriodEnd: Date | undefined;
      let priceId = sessionPriceId;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        currentPeriodEnd = resolveCurrentPeriodEndDate(subscription);
        priceId = subscription.items.data[0]?.price?.id ?? priceId;
      }

      let effectivePlanId = sessionPlanId;
      if (!effectivePlanId) {
        const nameFromCode =
          sessionPlanCode && sessionPlanCode in PLAN_NAME_BY_CODE
            ? PLAN_NAME_BY_CODE[sessionPlanCode as keyof typeof PLAN_NAME_BY_CODE]
            : undefined;
        const lookupName = sessionPlanName || nameFromCode;
        if (lookupName) {
          const planRecord = await prisma.membershipPlan.findFirst({
            where: { name: { equals: lookupName, mode: 'insensitive' } },
            select: { id: true },
          });
          effectivePlanId = planRecord?.id ?? undefined;
        }
      }

      await prisma.membershipSubscription.upsert({
        where: { userId },
        update: {
          status: 'ACTIVE',
          stripeCustomerId,
          stripeSubId: subscriptionId,
          ...(priceId ? { stripePriceId: priceId } : {}),
          ...(effectivePlanId ? { planId: effectivePlanId } : {}),
          ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
        },
        create: {
          userId,
          status: 'ACTIVE',
          stripeCustomerId,
          stripeSubId: subscriptionId,
          ...(priceId ? { stripePriceId: priceId } : {}),
          ...(effectivePlanId ? { planId: effectivePlanId } : {}),
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
      let membership = await prisma.membershipSubscription.findFirst({
        where: { stripeSubId: subscriptionId },
        include: {
          user: {
            include: { serviceMilesWallet: true }
          },
          plan: true
        }
      });

      // Check for price mismatch or missing data to ensure DB is in sync
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoicePriceId = (invoice.lines?.data?.[0] as any)?.price?.id;
      const isPriceMismatch = invoicePriceId && membership?.stripePriceId && membership.stripePriceId !== invoicePriceId;
      const isMissingData = !membership || !membership.user || !membership.plan;

      if (isMissingData || isPriceMismatch) {
         console.log(`[Stripe Webhook] Membership refresh needed. Reason: ${isMissingData ? 'Missing Data' : 'Price Mismatch'}. Sub: ${subscriptionId}`);
         const subscription = await stripe.subscriptions.retrieve(subscriptionId);
         await upsertMembershipFromStripeSubscription(subscription);
         
         membership = await prisma.membershipSubscription.findFirst({
            where: { stripeSubId: subscriptionId },
            include: {
              user: {
                include: { serviceMilesWallet: true }
              },
              plan: true
            }
         });
      }

      if (!membership || !membership.user) {
         console.warn(`[Stripe Webhook] Invoice paid but no linked membership found for sub ${subscriptionId} after recovery attempt.`);
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
        if (!plan) {
          let planCode = subscription.metadata?.planCode ? String(subscription.metadata.planCode) : undefined;
          let planName =
            subscription.metadata?.planName
              ? String(subscription.metadata.planName)
              : planCode && planCode in PLAN_NAME_BY_CODE
                ? PLAN_NAME_BY_CODE[planCode as keyof typeof PLAN_NAME_BY_CODE]
                : undefined;

          // FALLBACK: If subscription metadata is missing, try to find the Checkout Session
          if (!planName) {
             console.log(`[Stripe Webhook] Subscription metadata missing in invoice handler. Attempting to fetch Checkout Session for sub ${subscription.id}...`);
             try {
               const sessions = await stripe.checkout.sessions.list({ subscription: subscription.id, limit: 1 });
               const session = sessions.data[0];
               if (session?.metadata) {
                  console.log(`[Stripe Webhook] Found Checkout Session ${session.id}. Checking metadata...`, session.metadata);
                  planCode = session.metadata.planCode ? String(session.metadata.planCode) : undefined;
                  const nameFromCode = planCode && planCode in PLAN_NAME_BY_CODE
                     ? PLAN_NAME_BY_CODE[planCode as keyof typeof PLAN_NAME_BY_CODE]
                     : undefined;
                  planName = nameFromCode || (session.metadata.planName ? String(session.metadata.planName) : undefined);
               }
             } catch (err) {
               console.error(`[Stripe Webhook] Failed to fetch checkout sessions in invoice handler:`, err);
             }
          }

          if (planName) {
            plan = await prisma.membershipPlan.findFirst({
              where: { name: { equals: planName, mode: 'insensitive' } },
            });
            if (plan) {
              await prisma.membershipSubscription.update({
                where: { id: membership.id },
                data: { planId: plan.id, ...(priceId ? { stripePriceId: priceId } : {}) },
              });
            }
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
          where: { walletId: wallet.id, idempotencyKey: rollInKey } as any,
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
            } as any,
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
                } as any
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
                } as any
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
