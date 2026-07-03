import { describe, expect, it } from 'vitest';
import {
  formatBusinessMembershipInvoiceAmount,
  getBusinessMembershipInvoicePlanConfig,
} from './business-membership-invoice';

describe('business membership invoice pricing', () => {
  it('returns the configured Stripe amount for standard business plans', () => {
    const core = getBusinessMembershipInvoicePlanConfig('OTW BUSINESS CORE');
    const pro = getBusinessMembershipInvoicePlanConfig('otw business pro');
    const truePlan = getBusinessMembershipInvoicePlanConfig(' OTW TRUE ');

    expect(core.amountCents).toBe(69900);
    expect(core.supportsStripeInvoice).toBe(true);
    expect(pro.amountCents).toBe(119900);
    expect(truePlan.amountCents).toBe(149900);
  });

  it('treats enterprise and unknown plans as manual/custom pricing', () => {
    const enterprise = getBusinessMembershipInvoicePlanConfig('OTW ENTERPRISE');
    const unknown = getBusinessMembershipInvoicePlanConfig('Custom Negotiated Plan');

    expect(enterprise.amountCents).toBeNull();
    expect(enterprise.supportsStripeInvoice).toBe(false);
    expect(unknown.billingLabel).toBe('Custom pricing');
    expect(unknown.supportsStripeInvoice).toBe(false);
  });

  it('formats invoice amounts for admin messaging', () => {
    expect(formatBusinessMembershipInvoiceAmount(69900)).toBe('$699');
    expect(formatBusinessMembershipInvoiceAmount(149900)).toBe('$1,499');
    expect(formatBusinessMembershipInvoiceAmount(null)).toBe('Custom pricing');
  });
});
