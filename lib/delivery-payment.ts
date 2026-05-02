import { OverageBillingMode, Prisma, type PrismaClient } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { OTW_ORDERABLE_SERVICE_TYPES } from '@/lib/allowed-service-types';

const BASIC_PLAN_NAME = 'OTW BASIC';

export const DELIVERY_PAYMENT_PURPOSE = 'delivery_fee' as const;

export type DeliveryFeePaymentIntentResult = {
  alreadyPaid: boolean;
  amountCents: number;
  paymentIntentId: string | null;
  clientSecret: string | null;
};

export function resolveBillingMode(mode: OverageBillingMode | null | undefined): OverageBillingMode {
  return mode ?? OverageBillingMode.INSTANT;
}

export function shouldRequireDeliveryFeePayment(params: {
  deliveryFeeCents: number | null | undefined;
  deliveryFeePaid: boolean | null | undefined;
  billingMode: OverageBillingMode | null | undefined;
}): boolean {
  const amountCents = Number.isFinite(params.deliveryFeeCents)
    ? Math.max(0, Math.round(Number(params.deliveryFeeCents)))
    : 0;

  if (amountCents <= 0) {
    return false;
  }

  if (resolveBillingMode(params.billingMode) !== OverageBillingMode.INSTANT) {
    return false;
  }

  return params.deliveryFeePaid !== true;
}

async function ensureBasicMembership(
  prisma: PrismaClient,
  userId: string,
): Promise<{ id: string; stripeCustomerId: string | null }> {
  const existing = await prisma.membershipSubscription.findUnique({
    where: { userId },
    select: {
      id: true,
      stripeCustomerId: true,
    },
  });

  if (existing) {
    return existing;
  }

  const plan =
    (await prisma.membershipPlan.findUnique({ where: { name: BASIC_PLAN_NAME } })) ??
    (await prisma.membershipPlan.create({
      data: {
        name: BASIC_PLAN_NAME,
        description: 'Best for food, groceries, and quick errands.',
        monthlyServiceMiles: 60,
        rolloverCapMiles: 0,
        advanceDiscountMax: 0,
        priorityLevel: 0,
        markupFree: false,
        cashAllowed: false,
        peerToPeerAllowed: false,
        allowedServiceTypes: [...OTW_ORDERABLE_SERVICE_TYPES],
        overageBillingMode: OverageBillingMode.INSTANT,
        overageRateCentsPerMile: 200,
        overageMinimumCents: 500,
        overageCreditLimitCents: 0,
      },
      select: { id: true },
    }));

  try {
    const created = await prisma.membershipSubscription.create({
      data: {
        userId,
        planId: plan.id,
      },
      select: {
        id: true,
        stripeCustomerId: true,
      },
    });

    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const recovered = await prisma.membershipSubscription.findUnique({
        where: { userId },
        select: {
          id: true,
          stripeCustomerId: true,
        },
      });
      if (recovered) {
        return recovered;
      }
    }

    throw error;
  }
}

export async function ensureDeliveryFeePaymentIntentForRequest(
  deliveryRequestId: string,
): Promise<DeliveryFeePaymentIntentResult> {
  const prisma = getPrisma();
  const stripe = getStripe();

  const request = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryRequestId },
    select: {
      id: true,
      userId: true,
      deliveryFeeCents: true,
      deliveryFeePaid: true,
      deliveryPaymentIntentId: true,
      paymentRequired: true,
      overageBillingMode: true,
      user: {
        select: {
          email: true,
          neonAuthId: true,
          membership: {
            select: {
              id: true,
              stripeCustomerId: true,
            },
          },
        },
      },
    },
  });

  if (!request) {
    throw new Error('Delivery request not found');
  }

  const amountCents = Number.isFinite(request.deliveryFeeCents)
    ? Math.max(0, Math.round(Number(request.deliveryFeeCents)))
    : 0;

  if (amountCents <= 0) {
    throw new Error('Delivery fee amount is invalid');
  }

  if (
    !shouldRequireDeliveryFeePayment({
      deliveryFeeCents: request.deliveryFeeCents,
      deliveryFeePaid: request.deliveryFeePaid,
      billingMode: request.overageBillingMode,
    })
  ) {
    return {
      alreadyPaid: request.deliveryFeePaid,
      amountCents,
      paymentIntentId: request.deliveryPaymentIntentId,
      clientSecret: null,
    };
  }

  if (request.deliveryPaymentIntentId) {
    try {
      const existingIntent = await stripe.paymentIntents.retrieve(request.deliveryPaymentIntentId);

      if (existingIntent.status === 'succeeded') {
        await prisma.deliveryRequest.update({
          where: { id: request.id },
          data: {
            deliveryFeePaid: true,
            paymentRequired: false,
            deliveryPaymentIntentId: existingIntent.id,
          },
        });

        return {
          alreadyPaid: true,
          amountCents,
          paymentIntentId: existingIntent.id,
          clientSecret: null,
        };
      }

      if (existingIntent.client_secret && existingIntent.amount === amountCents) {
        if (!request.paymentRequired) {
          await prisma.deliveryRequest.update({
            where: { id: request.id },
            data: {
              paymentRequired: true,
            },
          });
        }

        return {
          alreadyPaid: false,
          amountCents,
          paymentIntentId: existingIntent.id,
          clientSecret: existingIntent.client_secret,
        };
      }
    } catch (error) {
      console.warn('[delivery-payment] Existing payment intent lookup failed', {
        requestId: request.id,
        paymentIntentId: request.deliveryPaymentIntentId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  const membership = await ensureBasicMembership(prisma, request.userId);
  let stripeCustomerId = request.user.membership?.stripeCustomerId ?? membership.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: request.user.email || undefined,
      metadata: {
        userId: request.userId,
        neonAuthId: request.user.neonAuthId,
      },
    });

    stripeCustomerId = customer.id;

    await prisma.membershipSubscription.update({
      where: {
        id: membership.id,
      },
      data: {
        stripeCustomerId,
      },
    });
  }

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: 'usd',
      customer: stripeCustomerId || undefined,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        purpose: DELIVERY_PAYMENT_PURPOSE,
        deliveryRequestId: request.id,
        userId: request.userId,
      },
    },
    {
      idempotencyKey: `delivery_fee_request:${request.id}`,
    },
  );

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return delivery payment client secret');
  }

  await prisma.deliveryRequest.update({
    where: { id: request.id },
    data: {
      deliveryPaymentIntentId: paymentIntent.id,
      paymentRequired: true,
      deliveryFeePaid: false,
    },
  });

  return {
    alreadyPaid: false,
    amountCents,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  };
}
