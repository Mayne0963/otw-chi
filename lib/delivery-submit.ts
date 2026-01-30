import { prisma } from './db';
import { calculateServiceMiles } from './service-miles';
import { isServiceTypeAllowedForPlan } from './service-miles-access';
import { UNLIMITED_SERVICE_MILES } from './membership-miles';
import {
  Prisma,
  DeliveryRequestStatus,
  ServiceMilesTransactionType,
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

export async function submitDeliveryRequest(input: SubmitDeliveryRequestInput) {
  const { userId, serviceType, travelMinutes, scheduledStart, payWithMiles = true } = input;

  return await prisma.$transaction(
    async (tx) => {
    // 1. Validate User & Membership
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

    // 2. Ensure Service Type Allowed
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
      if (existing) return existing;
    }

    // 3. Calculate Quote
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

    const wallet = await tx.serviceMilesWallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    const isUnlimited =
      wallet.balanceMiles === UNLIMITED_SERVICE_MILES ||
      plan.monthlyServiceMiles === UNLIMITED_SERVICE_MILES;

    if (payWithMiles && !isUnlimited) {
      const deduction = await tx.serviceMilesWallet.updateMany({
        where: { id: wallet.id, balanceMiles: { gte: quote.serviceMilesFinal } },
        data: {
          balanceMiles: {
            decrement: quote.serviceMilesFinal,
          },
        },
      });
      if (deduction.count !== 1) {
        throw new Error(`Insufficient Service Miles. Required: ${quote.serviceMilesFinal}`);
      }
    }

    // 5. Create Delivery Request
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

    const request = await tx.deliveryRequest.create({
      data: {
        userId,
        serviceType,
        pickupAddress: input.pickupAddress,
        dropoffAddress: input.dropoffAddress,
        notes: input.notes ?? null,
        scheduledStart,
        status: DeliveryRequestStatus.REQUESTED,
        idempotencyKey: input.idempotencyKey ?? null,
        
        // Mileage & Quote Data
        estimatedMinutes: quote.estimatedMinutes,
        serviceMilesBase: quote.serviceMilesBase,
        serviceMilesAdders: quote.serviceMilesAdders,
        serviceMilesDiscount: payWithMiles ? quote.serviceMilesDiscount : 0,
        serviceMilesFinal: payWithMiles ? quote.serviceMilesFinal : 0,
        quoteBreakdown: payWithMiles ? (quoteBreakdown as Prisma.InputJsonValue) : Prisma.JsonNull,
        deliveryFeePaid: payWithMiles, // Paid if using miles
        
        // Wait Time
        waitMinutes: input.waitMinutes ?? 10,
      },
    });

    if (payWithMiles) {
        // Update ledger with request ID
        // Note: We need to find the ledger entry we just created.
        // Since we are in a transaction, we can just create it here AFTER request creation to link it immediately.
        // Wait, I moved the ledger creation before request creation in the previous step?
        // Actually, in the previous SearchReplace, I added ledger creation BEFORE request creation but with null ID.
        // It's cleaner to do it AFTER request creation.
        // Let's revert the "null" creation and just do it here properly.
        
        // RE-CHECKING LOGIC:
        // The previous step added ledger creation block. I should remove it from there and put it here to have the ID.
        // OR, I can update it here.
        // Let's assume I'll fix the previous block in a moment or overwrite it.
        // Actually, the simplest way is to put the ledger creation HERE, after request is created.
        
        await tx.serviceMilesLedger.create({
            data: {
              walletId: wallet.id,
              amount: isUnlimited ? 0 : -quote.serviceMilesFinal,
              transactionType: ServiceMilesTransactionType.DEDUCT_REQUEST,
              deliveryRequestId: request.id,
              description: isUnlimited
                ? `Request recorded for ${serviceType} (${quote.serviceMilesFinal} miles; unlimited plan)`
                : `Request deduction for ${serviceType} (${quote.serviceMilesFinal} miles)`,
            },
        });
    }

    // 7. Write Ledger Entry (Original Code - Removed)
    /* 
    await tx.serviceMilesLedger.create({ ... });
    */

    return request;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function cancelDeliveryRequest(requestId: string, userId: string) {
  return await prisma.$transaction(
    async (tx) => {
    // 1. Fetch Request with Wallet
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
    const paidMiles = request.serviceMilesFinal || 0;
    if (request.status === DeliveryRequestStatus.CANCELED) {
      return { request, refundAmount: 0, feeAmount: 0, alreadyCanceled: true };
    }

    // 2. Determine Refund Amount
    let refundAmount = 0;
    let feeAmount = 0;

    // Policy:
    // - Cancel before ASSIGNED → full refund
    // - After ASSIGNED but before ARRIVED → 5 mile fee
    // - After ARRIVED → 15 mile fee minimum
    
    // Note: 'arrivedAt' field should be checked if we had strict timestamps, 
    // but status is a good proxy. 'PICKED_UP' implies 'ARRIVED'.
    // However, the prompt says "After ARRIVED". We need to check the 'arrivedAt' timestamp or status flow.
    // Let's rely on status + arrivedAt if available.
    
    const isAssigned = request.assignedDriverId !== null || request.status === DeliveryRequestStatus.ASSIGNED;
    const arrivedStatuses: DeliveryRequestStatus[] = [
      DeliveryRequestStatus.PICKED_UP,
      DeliveryRequestStatus.EN_ROUTE,
      DeliveryRequestStatus.DELIVERED,
    ];
    const isArrived = request.arrivedAt !== null || arrivedStatuses.includes(request.status);

    if (isArrived) {
        // Late cancellation fee: 15 miles
        feeAmount = 15;
        refundAmount = Math.max(0, paidMiles - feeAmount);
    } else if (isAssigned) {
        // Assigned cancellation fee: 5 miles
        feeAmount = 5;
        refundAmount = Math.max(0, paidMiles - feeAmount);
    } else {
        // Full refund
        feeAmount = 0;
        refundAmount = paidMiles;
    }

    // 3. Update Request Status
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

    // 4. Process Refund if applicable
    if (paidMiles > 0) {
      const wallet = await tx.serviceMilesWallet.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });

      // Unlimited plans keep a sentinel balance; no refund accounting required.
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
