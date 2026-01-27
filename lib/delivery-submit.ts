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
  idempotencyKey?: string;
}

export async function submitDeliveryRequest(input: SubmitDeliveryRequestInput) {
  const { userId, serviceType, travelMinutes, scheduledStart } = input;

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

    if (!isUnlimited) {
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
        serviceMilesDiscount: quote.serviceMilesDiscount,
        serviceMilesFinal: quote.serviceMilesFinal,
        quoteBreakdown: quote.quoteBreakdown as Prisma.InputJsonValue,
      },
    });

    // 7. Write Ledger Entry
    await tx.serviceMilesLedger.create({
      data: {
        walletId: wallet.id,
        amount: isUnlimited ? 0 : -quote.serviceMilesFinal, // Unlimited plans don't decrement wallet balance
        transactionType: ServiceMilesTransactionType.DEDUCT_REQUEST,
        deliveryRequestId: request.id,
        description: isUnlimited
          ? `Request recorded for ${serviceType} (${quote.serviceMilesFinal} miles; unlimited plan)`
          : `Request deduction for ${serviceType} (${quote.serviceMilesFinal} miles)`,
      },
    });

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
