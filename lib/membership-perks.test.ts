import { describe, expect, it } from 'vitest';
import {
  getCumulativeConsumerPlanPerks,
  getMembershipPlanPerks,
  resolveDeliveryPaymentPreferenceByPlan,
} from './membership-perks';

describe('membership perks', () => {
  it('enables plus-level multi-stop but not pro-only features', () => {
    const perks = getMembershipPlanPerks({
      priorityLevel: 1,
      cashAllowed: false,
      peerToPeerAllowed: false,
      markupFree: false,
      overageBillingMode: 'INSTANT',
    });

    expect(perks.canUseMultiStop).toBe(true);
    expect(perks.canUseReturnOrExchange).toBe(false);
    expect(perks.canUseSitAndWait).toBe(false);
    expect(perks.canUsePrioritySlot).toBe(false);
    expect(perks.canLockPreferredDriver).toBe(false);
    expect(perks.canUseMonthlyBilling).toBe(false);
    expect(perks.canUseCashHandling).toBe(false);
  });

  it('enables pro-level advanced workflow and priority slot', () => {
    const perks = getMembershipPlanPerks({
      priorityLevel: 2,
      cashAllowed: false,
      peerToPeerAllowed: false,
      markupFree: true,
      overageBillingMode: 'INSTANT',
    });

    expect(perks.canUseMultiStop).toBe(true);
    expect(perks.canUseReturnOrExchange).toBe(true);
    expect(perks.canUseSitAndWait).toBe(true);
    expect(perks.canUsePrioritySlot).toBe(true);
    expect(perks.canLockPreferredDriver).toBe(false);
    expect(perks.hasMarkupFree).toBe(true);
  });

  it('enables elite-level preferred driver lock and invoice billing', () => {
    const perks = getMembershipPlanPerks({
      priorityLevel: 3,
      cashAllowed: true,
      peerToPeerAllowed: true,
      markupFree: true,
      overageBillingMode: 'INVOICE',
    });

    expect(perks.canLockPreferredDriver).toBe(true);
    expect(perks.canUseMonthlyBilling).toBe(true);
    expect(perks.canUseCashHandling).toBe(true);
    expect(perks.canUsePeerToPeerDelivery).toBe(true);
  });

  it('falls back to instant payment when plan is missing or not invoice-enabled', () => {
    expect(resolveDeliveryPaymentPreferenceByPlan(null, 'MONTHLY')).toBe('INSTANT');
    expect(
      resolveDeliveryPaymentPreferenceByPlan(
        {
          overageBillingMode: 'INSTANT',
          priorityLevel: 4,
        },
        'MONTHLY',
      ),
    ).toBe('INSTANT');
  });

  it('accepts monthly preference when plan supports invoice overage', () => {
    expect(
      resolveDeliveryPaymentPreferenceByPlan(
        {
          overageBillingMode: 'INVOICE',
          priorityLevel: 3,
        },
        'MONTHLY',
      ),
    ).toBe('MONTHLY');
  });

  it('returns cumulative consumer perks for higher tiers', () => {
    expect(getCumulativeConsumerPlanPerks('OTW BASIC')).toEqual(['Food', 'Groceries', 'Quick errands']);
    expect(getCumulativeConsumerPlanPerks('OTW PLUS')).toEqual([
      'Food',
      'Groceries',
      'Quick errands',
      'Multi-stop',
      'Longer waits',
      'Light priority',
    ]);
    expect(getCumulativeConsumerPlanPerks('OTW PRO')).toContain('Food');
    expect(getCumulativeConsumerPlanPerks('OTW PRO')).toContain('Priority routing');
  });
});
