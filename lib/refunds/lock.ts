import { getPrisma } from '@/lib/db';

export interface LockEvaluationResult {
  locked: boolean;
  receiptStatus?: string;
  receiptVerified: boolean;
  customerConfirmed: boolean;
  lockedAt?: Date | null;
  lockReason?: string | null;
  refundPolicy: 'AUTO_ALLOWED' | 'LOCKED_REQUIRES_REVIEW';
}

export async function evaluateDeliveryRequestLock(deliveryRequestId: string): Promise<LockEvaluationResult> {
  const prisma = getPrisma();
  
  // Load DeliveryRequest with latest ReceiptVerification and OrderConfirmation
  const deliveryRequest = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryRequestId },
    include: {
      receiptVerifications: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      orderConfirmation: true
    }
  });

  if (!deliveryRequest) {
    throw new Error('Delivery request not found');
  }

  const latestReceipt = deliveryRequest.receiptVerifications[0];
  const orderConfirmation = deliveryRequest.orderConfirmation;

  // Determine receiptVerified
  const receiptVerified = latestReceipt ? 
    (latestReceipt.status === 'APPROVED' || latestReceipt.status === 'FLAGGED') : false;

  // Determine customerConfirmed
  const customerConfirmed = orderConfirmation ? 
    (orderConfirmation.customerConfirmed === true && orderConfirmation.confirmedAt !== null) : false;

  // Determine locked state
  const locked = receiptVerified && customerConfirmed;

  return {
    locked,
    receiptStatus: latestReceipt?.status,
    receiptVerified,
    customerConfirmed,
    lockedAt: deliveryRequest.lockedAt,
    lockReason: deliveryRequest.lockReason,
    refundPolicy: deliveryRequest.refundPolicy
  };
}

export function isRefundAllowedWithoutReview(lockInfo: LockEvaluationResult, disputePayload?: any): boolean {
  // If not locked, allow normal refund flow
  if (!lockInfo.locked) {
    return true;
  }

  // If locked, only allow refund through dispute process
  // This function can be extended to check dispute payload validity
  if (disputePayload && disputePayload.disputedItems && disputePayload.disputedItems.length > 0) {
    return true; // Allow if valid dispute is provided
  }

  return false;
}

export async function applyDeliveryRequestLock(
  deliveryRequestId: string, 
  userId: string, 
  reason: string = "RECEIPT+CONFIRMATION"
): Promise<void> {
  const prisma = getPrisma();
  
  // Get current state for audit log
  const currentRequest = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryRequestId },
    select: {
      isLocked: true,
      lockedAt: true,
      lockReason: true,
      refundPolicy: true
    }
  });

  if (!currentRequest) {
    throw new Error('Delivery request not found');
  }

  // Update the lock state
  const updatedRequest = await prisma.deliveryRequest.update({
    where: { id: deliveryRequestId },
    data: {
      isLocked: true,
      lockedAt: new Date(),
      lockReason: reason,
      refundPolicy: 'LOCKED_REQUIRES_REVIEW'
    }
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      deliveryRequestId,
      action: 'LOCK',
      details: { reason },
      previousState: {
        isLocked: currentRequest.isLocked,
        lockedAt: currentRequest.lockedAt,
        lockReason: currentRequest.lockReason,
        refundPolicy: currentRequest.refundPolicy
      },
      newState: {
        isLocked: updatedRequest.isLocked,
        lockedAt: updatedRequest.lockedAt,
        lockReason: updatedRequest.lockReason,
        refundPolicy: updatedRequest.refundPolicy
      }
    }
  });
}

export async function removeDeliveryRequestLock(
  deliveryRequestId: string, 
  userId: string, 
  reason: string
): Promise<void> {
  const prisma = getPrisma();
  
  // Get current state for audit log
  const currentRequest = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryRequestId },
    select: {
      isLocked: true,
      lockedAt: true,
      lockReason: true,
      refundPolicy: true
    }
  });

  if (!currentRequest) {
    throw new Error('Delivery request not found');
  }

  // Update the lock state
  const updatedRequest = await prisma.deliveryRequest.update({
    where: { id: deliveryRequestId },
    data: {
      isLocked: false,
      lockedAt: null,
      lockReason: reason,
      refundPolicy: 'AUTO_ALLOWED'
    }
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      deliveryRequestId,
      action: 'UNLOCK',
      details: { reason },
      previousState: {
        isLocked: currentRequest.isLocked,
        lockedAt: currentRequest.lockedAt,
        lockReason: currentRequest.lockReason,
        refundPolicy: currentRequest.refundPolicy
      },
      newState: {
        isLocked: updatedRequest.isLocked,
        lockedAt: updatedRequest.lockedAt,
        lockReason: updatedRequest.lockReason,
        refundPolicy: updatedRequest.refundPolicy
      }
    }
  });
}
