import { prisma } from './db';
import { calculateServiceMiles } from './service-miles';
import type { ServiceType } from '@prisma/client';
import { DeliveryRequestStatus, ServiceMilesTransactionType } from '@prisma/client';

export interface SubmitDeliveryRequestInput {
  userId: string;
  serviceType: ServiceType;
  pickupAddress: string;
  dropoffAddress: string;
  notes?: string;
  scheduledStart: Date;
  estimatedMinutes: number;
  waitMinutes?: number;
  numberOfStops?: number;
  returnOrExchange?: boolean;
  cashHandling?: boolean;
  peakHours?: boolean;
}

export async function submitDeliveryRequest(input: SubmitDeliveryRequestInput) {
  const { userId, serviceType, estimatedMinutes, scheduledStart } = input;

  return await prisma.$transaction(async (tx) => {
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
    if (plan.allowedServiceTypes) {
      const allowedTypes = plan.allowedServiceTypes as string[];
      if (!allowedTypes.includes(serviceType)) {
        throw new Error(`Service type ${serviceType} not allowed for this plan`);
      }
    }

    // 3. Calculate Quote
    const quote = calculateServiceMiles({
      estimatedMinutes,
      serviceType,
      scheduledStart,
      waitMinutes: input.waitMinutes,
      numberOfStops: input.numberOfStops,
      returnOrExchange: input.returnOrExchange,
      cashHandling: input.cashHandling,
      peakHours: input.peakHours,
      advanceDiscountMax: plan.advanceDiscountMax,
    });

    // 4. Check Wallet Balance
    let wallet = user.serviceMilesWallet;
    
    // Auto-create wallet if missing (safety net)
    if (!wallet) {
        wallet = await tx.serviceMilesWallet.create({
            data: { userId: user.id }
        });
    }

    if (wallet.balanceMiles < quote.serviceMilesFinal) {
      throw new Error(`Insufficient Service Miles. Required: ${quote.serviceMilesFinal}, Available: ${wallet.balanceMiles}`);
    }

    // 5. Create Delivery Request
    const request = await tx.deliveryRequest.create({
      data: {
        userId,
        serviceType,
        pickupAddress: input.pickupAddress,
        dropoffAddress: input.dropoffAddress,
        notes: input.notes,
        scheduledStart,
        status: DeliveryRequestStatus.REQUESTED,
        
        // Mileage & Quote Data
        estimatedMinutes,
        serviceMilesBase: quote.serviceMilesBase,
        serviceMilesAdders: quote.serviceMilesAdders,
        serviceMilesDiscount: quote.serviceMilesDiscount,
        serviceMilesFinal: quote.serviceMilesFinal,
        quoteBreakdown: quote.quoteBreakdown as any, // Storing JSON
      },
    });

    // 6. Deduct Miles
    await tx.serviceMilesWallet.update({
      where: { id: wallet.id },
      data: {
        balanceMiles: {
          decrement: quote.serviceMilesFinal,
        },
      },
    });

    // 7. Write Ledger Entry
    await tx.serviceMilesLedger.create({
      data: {
        walletId: wallet.id,
        amount: -quote.serviceMilesFinal, // Negative for deduction
        transactionType: ServiceMilesTransactionType.DEDUCT_REQUEST,
        deliveryRequestId: request.id,
        description: `Request deduction for ${serviceType} (${quote.serviceMilesFinal} miles)`,
      },
    });

    return request;
  });
}

export async function cancelDeliveryRequest(requestId: string, userId: string) {
  return await prisma.$transaction(async (tx) => {
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
    if (!request.user.serviceMilesWallet) throw new Error('Wallet not found');
    
    // Idempotency Check: Already cancelled?
    if (request.status === DeliveryRequestStatus.CANCELED) {
        return request; // No-op
    }

    // 2. Determine Refund Amount
    let refundAmount = 0;
    let feeAmount = 0;
    const paidMiles = request.serviceMilesFinal || 0;

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
    const updatedRequest = await tx.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: DeliveryRequestStatus.CANCELED,
      },
    });

    // 4. Process Refund if applicable
    if (refundAmount > 0) {
        const wallet = request.user.serviceMilesWallet;
        
        // Credit Wallet
        await tx.serviceMilesWallet.update({
            where: { id: wallet.id },
            data: {
                balanceMiles: {
                    increment: refundAmount
                }
            }
        });

        // Write Ledger
        await tx.serviceMilesLedger.create({
            data: {
                walletId: wallet.id,
                amount: refundAmount,
                transactionType: ServiceMilesTransactionType.ADJUST,
                deliveryRequestId: request.id,
                description: `Cancellation Refund (Fee: ${feeAmount} miles)`,
            }
        });
    }

    return {
        request: updatedRequest,
        refundAmount,
        feeAmount
    };
  });
}
