export type DeliveryPaymentPreference = 'INSTANT' | 'MONTHLY';

export type MembershipPlanPerkSnapshot = {
  name?: string | null;
  priorityLevel?: number | null;
  cashAllowed?: boolean | null;
  peerToPeerAllowed?: boolean | null;
  markupFree?: boolean | null;
  overageBillingMode?: string | null;
} | null | undefined;

const MULTI_STOP_MIN_PRIORITY_LEVEL = 1; // OTW PLUS+
const ADVANCED_WORKFLOW_MIN_PRIORITY_LEVEL = 2; // OTW PRO+
const LOCKED_DRIVER_MIN_PRIORITY_LEVEL = 3; // OTW ELITE+

function toPriorityLevel(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(Number(value)));
}

export function getMembershipPlanPerks(plan: MembershipPlanPerkSnapshot) {
  const priorityLevel = toPriorityLevel(plan?.priorityLevel);

  return {
    priorityLevel,
    canUseMultiStop: priorityLevel >= MULTI_STOP_MIN_PRIORITY_LEVEL,
    canUseSitAndWait: priorityLevel >= ADVANCED_WORKFLOW_MIN_PRIORITY_LEVEL,
    canUseReturnOrExchange: priorityLevel >= ADVANCED_WORKFLOW_MIN_PRIORITY_LEVEL,
    canUsePrioritySlot: priorityLevel >= ADVANCED_WORKFLOW_MIN_PRIORITY_LEVEL,
    canLockPreferredDriver: priorityLevel >= LOCKED_DRIVER_MIN_PRIORITY_LEVEL,
    canUseMonthlyBilling: String(plan?.overageBillingMode ?? '').toUpperCase() === 'INVOICE',
    canUseCashHandling: plan?.cashAllowed === true,
    canUsePeerToPeerDelivery: plan?.peerToPeerAllowed === true,
    hasMarkupFree: plan?.markupFree === true,
  };
}

export function resolveDeliveryPaymentPreferenceByPlan(
  plan: MembershipPlanPerkSnapshot,
  requestedPreference: DeliveryPaymentPreference | null | undefined,
): DeliveryPaymentPreference {
  return getMembershipPlanPerks(plan).canUseMonthlyBilling && requestedPreference === 'MONTHLY'
    ? 'MONTHLY'
    : 'INSTANT';
}
