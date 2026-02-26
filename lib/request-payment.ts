import { OverageBillingMode } from '@prisma/client';
import { shouldRequireDeliveryFeePayment } from '@/lib/delivery-payment';

export const DISPATCH_PAYMENT_REQUIRED_ERROR = 'Payment required before dispatch';

export type DispatchPaymentSnapshot = {
  paymentRequired: boolean;
  deliveryFeeCents: number | null;
  deliveryFeePaid: boolean;
  overageBillingMode: OverageBillingMode | null;
};

export function isDispatchBlockedByDeliveryFee(snapshot: DispatchPaymentSnapshot): boolean {
  return shouldRequireDeliveryFeePayment({
    deliveryFeeCents: snapshot.deliveryFeeCents,
    deliveryFeePaid: snapshot.deliveryFeePaid,
    billingMode: snapshot.overageBillingMode,
  });
}

export function isDispatchBlockedByPayment(snapshot: DispatchPaymentSnapshot): boolean {
  if (snapshot.paymentRequired) {
    return true;
  }

  return isDispatchBlockedByDeliveryFee(snapshot);
}
