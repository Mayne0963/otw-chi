const BUSINESS_MEMBERSHIP_INVOICE_PLAN_CONFIG = {
  'OTW BUSINESS CORE': {
    amountCents: 69_900,
    billingLabel: '$699 / month',
  },
  'OTW BUSINESS PRO': {
    amountCents: 119_900,
    billingLabel: '$1,199 / month',
  },
  'OTW TRUE': {
    amountCents: 149_900,
    billingLabel: 'Starting at $1,499 / month',
  },
  'OTW ENTERPRISE': {
    amountCents: null,
    billingLabel: 'Custom pricing',
  },
} as const;

type SupportedBusinessMembershipPlanName = keyof typeof BUSINESS_MEMBERSHIP_INVOICE_PLAN_CONFIG;

function normalizeBusinessMembershipPlanName(planName: string | null | undefined) {
  return planName?.trim().toUpperCase() ?? '';
}

export function getBusinessMembershipInvoicePlanConfig(planName: string | null | undefined) {
  const normalizedPlanName = normalizeBusinessMembershipPlanName(planName);
  const config =
    BUSINESS_MEMBERSHIP_INVOICE_PLAN_CONFIG[
      normalizedPlanName as SupportedBusinessMembershipPlanName
    ];

  if (config) {
    return {
      normalizedPlanName,
      amountCents: config.amountCents,
      billingLabel: config.billingLabel,
      supportsStripeInvoice: typeof config.amountCents === 'number' && config.amountCents > 0,
    };
  }

  return {
    normalizedPlanName,
    amountCents: null,
    billingLabel: 'Custom pricing',
    supportsStripeInvoice: false,
  };
}

export function formatBusinessMembershipInvoiceAmount(amountCents: number | null | undefined) {
  if (typeof amountCents !== 'number' || amountCents <= 0) return 'Custom pricing';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}
