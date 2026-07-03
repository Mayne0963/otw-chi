import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveInitialDeliveryFeePaid } from './delivery-fee-settlement';

describe('resolveInitialDeliveryFeePaid', () => {
  it('marks miles-backed delivery fees as settled on creation', () => {
    expect(
      resolveInitialDeliveryFeePaid({
        deliveryFeeCents: 4250,
        payWithMiles: true,
        consumedOtwTrueBenefit: false,
      }),
    ).toBe(true);
  });

  it('preserves unpaid delivery fees when card payment is expected', () => {
    expect(
      resolveInitialDeliveryFeePaid({
        deliveryFeeCents: 4250,
        payWithMiles: false,
        consumedOtwTrueBenefit: false,
      }),
    ).toBe(false);
  });

  it('treats OTW True benefit requests as settled', () => {
    expect(
      resolveInitialDeliveryFeePaid({
        deliveryFeeCents: 4250,
        payWithMiles: false,
        consumedOtwTrueBenefit: true,
      }),
    ).toBe(true);
  });
});
