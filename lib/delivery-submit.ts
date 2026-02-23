import { prisma } from './db';
import { getStripe } from './stripe';
import { calculateServiceMiles } from './service-miles';
import { isServiceTypeAllowedForPlan } from './service-miles-access';
import { UNLIMITED_SERVICE_MILES } from './membership-miles';
import { computeOverage } from './overage';
import { addLineItem, getPeriodKey, recomputePeriodTotal, upsertPeriod } from './overage-invoice';
import {
  Prisma,
  DeliveryRequestStatus,
  OverageBillingMode,
  OverageStatus,
  ServiceMilesTransactionType,
  type DeliveryRequest,
  type ServiceType,
} from '@prisma/client';

export interface SubmitDeliveryRequestInput {
  userId: string;
  serviceType: ServiceType;
  pickupAddress: string;
  dropoffAddress: string;
  notes?: string;
  scheduledStart: Date;
  travelMinutes: number;
  quotedAt?: Date;
  waitMinutes?: number;
  sitAndWait?: boolean;
  numberOfStops?: number;
  returnOrExchange?: boolean;
  cashHandling?: boolean;
  peakHours?: boolean;
  prioritySlot?: boolean;
  preferredDriverId?: string;
  lockToPreferred?: boolean;
  idempotencyKey?: string;
  payWithMiles?: boolean;

  // New fields for full order support
  restaurantName?: string;
  restaurantWebsite?: string;
  receiptImageData?: string;
  receiptVendor?: string;
  receiptLocation?: string;
  receiptItems?: Prisma.InputJsonValue;
  receiptAuthenticityScore?: number;
  deliveryFeeCents?: number;
  deliveryFeePaid?: boolean;
  deliveryCheckoutSessionId?: string;
  couponCode?: string;
  discountCents?: number;
  tipCents?: number;
}

export interface SubmitDeliveryRequestResult {
  request: DeliveryRequest;
  paymentRequired: boolean;
  overageMiles: number;
  overageCents: number;
  overageBillingMode: OverageBillingMode | null;
  overagePaymentIntentId: string | null;
  overageClientSecret: string | null;
}

async function ensureOveragePaymentIntent(
  requestId: string
): Promise<{ paymentIntentId: string; clientSecret: string }> {
  const request = await prisma.deliveryRequest.findUnique({
    where: { id: requestId },
    include: {
      user: {
        include: {
          membership: {
            include: {
              plan: true,
            },
          },
        },
      },
    },
  });

  if (!request) {
    throw new Error('Delivery request not found for overage payment');
  }

  if (
    request.overageBillingMode !== OverageBillingMode.INSTANT ||
    request.overageMiles <= 0 ||
    request.overageCents <= 0
  ) {
    throw new Error('Request is not eligible for instant overage payment');
  }

  const stripe = getStripe();

  if (request.overagePaymentIntentId) {
    const existingIntent = await stripe.paymentIntents.retrieve(request.overagePaymentIntentId);
    if (existingIntent.client_secret) {
      return {
        paymentIntentId: existingIntent.id,
        clientSecret: existingIntent.client_secret,
      };
    }
  }

  const membership = request.user.membership;
  if (!membership) {
    throw new Error('Active membership required for overage payment');
  }

  let stripeCustomerId = membership.stripeCustomerId;
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
      where: { userId: request.userId },
      data: { stripeCustomerId },
    });
  }

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: request.overageCents,
      currency: 'usd',
      customer: stripeCustomerId || undefined,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        purpose: 'overage_payment',
        userId: request.userId,
        deliveryRequestId: request.id,
      },
    },
    {
      idempotencyKey: `overage_request:${request.id}`,
    }
  );

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return overage client secret');
  }

  await prisma.deliveryRequest.update({
    where: { id: request.id },
    data: {
      overagePaymentIntentId: paymentIntent.id,
    },
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  };
}

export async function submitDeliveryRequest(
  input: SubmitDeliveryRequestInput
): Promise<SubmitDeliveryRequestResult> {
  const { userId, serviceType, travelMinutes, scheduledStart, payWithMiles = true } = input;

  const txResult = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          membership: {
            include: {
              plan: true,
            },
          },
          serviceMilesWallet: true,
        },
      });

      if (!user) throw new Error('User not found');
      if (!user.membership || user.membership.status !== 'ACTIVE') {
        throw new Error('Active membership required');
      }

      const plan = user.membership.plan;
      if (!plan) throw new Error('Membership plan not found');

      const eligibleForPriority =
        plan.name.toUpperCase().includes('OTW ELITE') || plan.name.toUpperCase().includes('OTW BLACK');
      const wantsPriority =
        Boolean(input.prioritySlot) || Boolean(input.preferredDriverId) || Boolean(input.lockToPreferred);
      if (wantsPriority && !eligibleForPriority) {
        throw new Error('Priority scheduling is not enabled for this plan');
      }
      if (input.lockToPreferred && !input.preferredDriverId) {
        throw new Error('Preferred driver is required when locking');
      }

      if (!isServiceTypeAllowedForPlan(plan.allowedServiceTypes, serviceType)) {
        throw new Error(`Service type ${serviceType} not allowed for this plan`);
      }

      if (input.cashHandling && !plan.cashAllowed) {
        throw new Error('Cash handling is not allowed for this plan');
      }

      if (input.idempotencyKey) {
        const existing = await tx.deliveryRequest.findFirst({
          where: { userId, idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          return {
            request: existing,
          };
        }
      }

      const quotedAt = input.quotedAt ?? new Date();
      const quote = calculateServiceMiles({
        travelMinutes,
        serviceType,
        scheduledStart,
        quotedAt,
        waitMinutes: input.waitMinutes,
        sitAndWait: input.sitAndWait,
        numberOfStops: input.numberOfStops,
        returnOrExchange: input.returnOrExchange,
        cashHandling: input.cashHandling,
        peakHours: input.peakHours,
        advanceDiscountMax: plan.advanceDiscountMax,
      });

      const requiredMiles = quote.serviceMilesFinal;
      const wallet = await tx.serviceMilesWallet.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });

      const isUnlimited =
        wallet.balanceMiles === UNLIMITED_SERVICE_MILES ||
        plan.monthlyServiceMiles === UNLIMITED_SERVICE_MILES;

      let milesUsed = 0;
      let overageMiles = 0;
      let overageCents = 0;
      let overageBillingMode: OverageBillingMode | null = null;
      let overageStatus: OverageStatus = OverageStatus.NONE;
      let paymentRequired = false;
      let invoicePeriodId: string | null = null;

      if (payWithMiles) {
        overageBillingMode = plan.overageBillingMode;

        const availableMiles = isUnlimited ? requiredMiles : Math.max(0, wallet.balanceMiles);
        const overage = computeOverage({
          requiredMiles,
          availableMiles,
          rateCentsPerMile: plan.overageRateCentsPerMile,
          minCents: plan.overageMinimumCents,
        });

        milesUsed = overage.milesUsed;
        overageMiles = overage.overageMiles;
        overageCents = overage.overageCents;

        if (overageMiles > 0 && plan.overageRateCentsPerMile <= 0) {
          throw new Error('Membership plan overage pricing is not configured');
        }

        if (
          overageBillingMode === OverageBillingMode.INVOICE &&
          overageCents > 0 &&
          plan.overageCreditLimitCents > 0
        ) {
          const periodKey = getPeriodKey(new Date());
          const period = await upsertPeriod(tx, userId, periodKey);
          const { totalCents } = await recomputePeriodTotal(tx, period.id);

          if (totalCents + overageCents > plan.overageCreditLimitCents) {
            throw new Error(
              `Overage credit limit exceeded for ${periodKey}. Available credit: ${Math.max(
                0,
                plan.overageCreditLimitCents - totalCents
              )} cents.`
            );
          }

          invoicePeriodId = period.id;
        }

        if (!isUnlimited && milesUsed > 0) {
          const deduction = await tx.serviceMilesWallet.updateMany({
            where: { id: wallet.id, balanceMiles: { gte: milesUsed } },
            data: {
              balanceMiles: {
                decrement: milesUsed,
              },
            },
          });

          if (deduction.count !== 1) {
            throw new Error('Service Miles balance changed. Please retry your request.');
          }
        }

        if (overageMiles > 0) {
          if (overageBillingMode === OverageBillingMode.INSTANT) {
            overageStatus = OverageStatus.PENDING;
            paymentRequired = true;
          } else {
            overageStatus = OverageStatus.PENDING;
          }
        }
      }

      const lockExpiresAtIso =
        input.lockToPreferred && input.preferredDriverId
          ? new Date(quotedAt.getTime() + 30 * 60 * 1000).toISOString()
          : null;
      const quoteBreakdown = {
        ...quote.quoteBreakdown,
        dispatchPreferences: {
          prioritySlot: Boolean(input.prioritySlot),
          preferredDriverId: input.preferredDriverId ?? null,
          lockToPreferred: Boolean(input.lockToPreferred),
          lockExpiresAtIso,
        },
      };

      let request = await tx.deliveryRequest.create({
        data: {
          userId,
          serviceType,
          pickupAddress: input.pickupAddress,
          dropoffAddress: input.dropoffAddress,
          notes: input.notes ?? null,
          restaurantName: input.restaurantName ?? null,
          restaurantWebsite: input.restaurantWebsite ?? null,
          receiptImageData: input.receiptImageData ?? null,
          receiptVendor: input.receiptVendor ?? null,
          receiptLocation: input.receiptLocation ?? null,
          receiptItems: input.receiptItems ?? Prisma.JsonNull,
          receiptAuthenticityScore: input.receiptAuthenticityScore ?? null,
          deliveryFeeCents: input.deliveryFeeCents ?? null,
          deliveryCheckoutSessionId: input.deliveryCheckoutSessionId ?? null,
          couponCode: input.couponCode ?? null,
          discountCents: input.discountCents ?? null,
          tipCents: input.tipCents ?? 0,
          scheduledStart,
          status: DeliveryRequestStatus.REQUESTED,
          idempotencyKey: input.idempotencyKey ?? null,

          estimatedMinutes: quote.estimatedMinutes,
          serviceMilesBase: quote.serviceMilesBase,
          serviceMilesAdders: quote.serviceMilesAdders,
          serviceMilesDiscount: quote.serviceMilesDiscount,
          serviceMilesFinal: requiredMiles,
          milesUsed,
          overageMiles,
          overageCents,
          overageBillingMode,
          overageStatus,
          paymentRequired,
          quoteBreakdown: quoteBreakdown as Prisma.InputJsonValue,
          deliveryFeePaid: input.deliveryFeePaid ?? payWithMiles,
          receiptVerifiedAt: input.receiptItems ? new Date() : null,

          waitMinutes: input.waitMinutes ?? 10,
        },
      });

      if (payWithMiles && (isUnlimited || milesUsed > 0)) {
        const ledgerRef = `request:${request.id}:MILES_DEDUCT`;
        await tx.serviceMilesLedger.upsert({
          where: {
            externalRef: ledgerRef,
          },
          update: {},
          create: {
            walletId: wallet.id,
            amount: isUnlimited ? 0 : -milesUsed,
            transactionType: ServiceMilesTransactionType.DEDUCT_REQUEST,
            deliveryRequestId: request.id,
            idempotencyKey: ledgerRef,
            externalRef: ledgerRef,
            description: isUnlimited
              ? `Request recorded for ${serviceType} (${requiredMiles} miles; unlimited plan)`
              : `Request deduction for ${serviceType} (${milesUsed} miles used)`,
          },
        });
      }

      if (
        payWithMiles &&
        overageBillingMode === OverageBillingMode.INVOICE &&
        overageMiles > 0 &&
        overageCents > 0
      ) {
        const periodKey = getPeriodKey(new Date());
        const period =
          invoicePeriodId !== null
            ? await tx.overageInvoicePeriod.findUnique({ where: { id: invoicePeriodId } })
            : null;
        const resolvedPeriod = period ?? (await upsertPeriod(tx, userId, periodKey));

        await addLineItem(tx, {
          periodId: resolvedPeriod.id,
          userId,
          requestId: request.id,
          overageCents,
        });

        await recomputePeriodTotal(tx, resolvedPeriod.id);

        request = await tx.deliveryRequest.update({
          where: { id: request.id },
          data: {
            overageInvoiceId: resolvedPeriod.id,
            overageStatus: OverageStatus.PENDING,
          },
        });
      }

      return {
        request,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  let overagePaymentIntentId = txResult.request.overagePaymentIntentId;
  let overageClientSecret: string | null = null;

  if (
    txResult.request.paymentRequired &&
    txResult.request.overageBillingMode === OverageBillingMode.INSTANT &&
    txResult.request.overageMiles > 0 &&
    txResult.request.overageCents > 0
  ) {
    const intent = await ensureOveragePaymentIntent(txResult.request.id);
    overagePaymentIntentId = intent.paymentIntentId;
    overageClientSecret = intent.clientSecret;
    txResult.request = await prisma.deliveryRequest.findUniqueOrThrow({
      where: { id: txResult.request.id },
    });
  }

  return {
    request: txResult.request,
    paymentRequired: txResult.request.paymentRequired,
    overageMiles: txResult.request.overageMiles,
    overageCents: txResult.request.overageCents,
    overageBillingMode: txResult.request.overageBillingMode,
    overagePaymentIntentId,
    overageClientSecret,
  };
}

export async function cancelDeliveryRequest(requestId: string, userId: string) {
  return await prisma.$transaction(
    async (tx) => {
      const request = await tx.deliveryRequest.findFirst({
        where: { id: requestId, userId },
        include: {
          user: {
            include: {
              serviceMilesWallet: true,
            },
          },
        },
      });

      if (!request) throw new Error('Request not found');
      if (request.completedAt || request.status === DeliveryRequestStatus.DELIVERED) {
        throw new Error('Completed requests cannot be canceled');
      }

      const paidMiles = request.milesUsed > 0 ? request.milesUsed : request.serviceMilesFinal || 0;
      if (request.status === DeliveryRequestStatus.CANCELED) {
        return { request, refundAmount: 0, feeAmount: 0, alreadyCanceled: true };
      }

      let refundAmount = 0;
      let feeAmount = 0;

      const isAssigned = request.assignedDriverId !== null || request.status === DeliveryRequestStatus.ASSIGNED;
      const arrivedStatuses: DeliveryRequestStatus[] = [
        DeliveryRequestStatus.PICKED_UP,
        DeliveryRequestStatus.EN_ROUTE,
        DeliveryRequestStatus.DELIVERED,
      ];
      const isArrived = request.arrivedAt !== null || arrivedStatuses.includes(request.status);

      if (isArrived) {
        feeAmount = 15;
        refundAmount = Math.max(0, paidMiles - feeAmount);
      } else if (isAssigned) {
        feeAmount = 5;
        refundAmount = Math.max(0, paidMiles - feeAmount);
      } else {
        feeAmount = 0;
        refundAmount = paidMiles;
      }

      const cancelled = await tx.deliveryRequest.updateMany({
        where: {
          id: requestId,
          userId,
          status: { not: DeliveryRequestStatus.CANCELED },
        },
        data: { status: DeliveryRequestStatus.CANCELED },
      });
      const updatedRequest = await tx.deliveryRequest.findUnique({
        where: { id: requestId },
      });
      if (!updatedRequest) throw new Error('Request not found');
      if (cancelled.count !== 1) {
        return { request: updatedRequest, refundAmount: 0, feeAmount: 0, alreadyCanceled: true };
      }

      if (paidMiles > 0) {
        const wallet = await tx.serviceMilesWallet.upsert({
          where: { userId },
          update: {},
          create: { userId },
        });

        if (wallet.balanceMiles === UNLIMITED_SERVICE_MILES) {
          return { request: updatedRequest, refundAmount: 0, feeAmount, alreadyCanceled: false };
        }

        if (refundAmount > 0) {
          await tx.serviceMilesWallet.update({
            where: { id: wallet.id },
            data: {
              balanceMiles: {
                increment: refundAmount,
              },
            },
          });

          await tx.serviceMilesLedger.create({
            data: {
              walletId: wallet.id,
              amount: refundAmount,
              transactionType: ServiceMilesTransactionType.ADJUST,
              deliveryRequestId: request.id,
              description: `Cancellation Refund (Fee: ${feeAmount} miles)`,
            },
          });
        }
      }

      return { request: updatedRequest, refundAmount, feeAmount, alreadyCanceled: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
