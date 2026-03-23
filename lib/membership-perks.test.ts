import { describe, expect, it } from 'vitest';
import {
  getCumulativeConsumerPlanPerks,
  getConsumerPlanDisplayPerks,
  getMembershipPlanPerks,
  resolveDeliveryPaymentPreferenceByPlan,
} from './membership-perks';

describe('membership perks', () => {
  it('keeps plus-level perks below the multi-stop tier', () => {
    const perks = getMembershipPlanPerks({
      priorityLevel: 1,
      cashAllowed: false,
      peerToPeerAllowed: false,
      markupFree: false,
      overageBillingMode: 'INSTANT',
    });

    expect(perks.canUseMultiStop).toBe(false);
    expect(perks.canUseReturnOrExchange).toBe(false);
    expect(perks.canUseSitAndWait).toBe(false);
    expect(perks.canUsePrioritySlot).toBe(false);
    expect(perks.canLockPreferredDriver).toBe(false);
    expect(perks.canUseMonthlyBilling).toBe(false);
    expect(perks.canUseCashHandling).toBe(false);
  });

  it('enables pro-level advanced workflow and priority slot without multi-stop', () => {
    const perks = getMembershipPlanPerks({
      priorityLevel: 2,
      cashAllowed: false,
      peerToPeerAllowed: false,
      markupFree: true,
      overageBillingMode: 'INSTANT',
    });

    expect(perks.canUseMultiStop).toBe(false);
    expect(perks.canUseReturnOrExchange).toBe(true);
    expect(perks.canUseSitAndWait).toBe(true);
    expect(perks.canUsePrioritySlot).toBe(true);
    expect(perks.canLockPreferredDriver).toBe(false);
    expect(perks.hasMarkupFree).toBe(true);
  });

  it('enables elite-level multi-stop, preferred driver lock, and invoice billing', () => {
    const perks = getMembershipPlanPerks({
      priorityLevel: 3,
      cashAllowed: true,
      peerToPeerAllowed: true,
      markupFree: true,
      overageBillingMode: 'INVOICE',
    });

    expect(perks.canUseMultiStop).toBe(true);
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
      'Longer waits',
      'Light priority',
    ]);
    expect(getCumulativeConsumerPlanPerks('OTW PRO')).toContain('Food');
    expect(getCumulativeConsumerPlanPerks('OTW PRO')).toContain('Priority routing');
    expect(getCumulativeConsumerPlanPerks('OTW ELITE')).toContain('Multi-stop');
  });

  it('returns short display perks that inherit from previous tiers', () => {
    expect(getConsumerPlanDisplayPerks('OTW BASIC')).toEqual(['Food', 'Groceries', 'Quick errands']);
    expect(getConsumerPlanDisplayPerks('OTW PLUS')).toEqual([
      'Everything in OTW BASIC',
      'Longer waits',
      'Light priority',
    ]);
    expect(getConsumerPlanDisplayPerks('OTW PRO')).toEqual([
      'Everything in OTW PLUS',
      'Returns & exchanges',
      'Sit-and-wait',
      'No item markups',
      'Priority routing',
    ]);
    expect(getConsumerPlanDisplayPerks('OTW ELITE')).toEqual([
      'Everything in OTW PRO',
      'Multi-stop',
      'Peer-to-peer delivery',
      'Cash handling',
      'Priority support',
    ]);
  });
});
