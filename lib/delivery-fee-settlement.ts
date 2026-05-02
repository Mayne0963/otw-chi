export function resolveInitialDeliveryFeePaid(params: {
  deliveryFeeCents: number;
  deliveryFeePaid?: boolean;
  payWithMiles: boolean;
  consumedOtwTrueBenefit: boolean;
}) {
  if (params.consumedOtwTrueBenefit) {
    return true;
  }

  if (typeof params.deliveryFeePaid === 'boolean') {
    return params.deliveryFeePaid;
  }

  if (params.payWithMiles) {
    return true;
  }

  return params.deliveryFeeCents <= 0;
}
