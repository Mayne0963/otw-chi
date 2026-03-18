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
const CONSUMER_PLAN_ORDER = ['OTW BASIC', 'OTW PLUS', 'OTW PRO', 'OTW ELITE', 'OTW BLACK'] as const;
type ConsumerPlanName = (typeof CONSUMER_PLAN_ORDER)[number];

const CONSUMER_PLAN_PERK_DELTAS: Record<ConsumerPlanName, string[]> = {
  'OTW BASIC': ['Food', 'Groceries', 'Quick errands'],
  'OTW PLUS': ['Multi-stop', 'Longer waits', 'Light priority'],
  'OTW PRO': ['Returns & exchanges', 'Sit-and-wait', 'No item markups', 'Priority routing'],
  'OTW ELITE': ['Peer-to-peer delivery', 'Cash handling', 'Priority support'],
  'OTW BLACK': ['Emergency requests', 'Same rep when possible', 'Handle it mode'],
};

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

export function getCumulativeConsumerPlanPerks(planName: string | null | undefined): string[] {
  const normalized = String(planName ?? '').trim().toUpperCase() as ConsumerPlanName;
  const planIndex = CONSUMER_PLAN_ORDER.indexOf(normalized);
  if (planIndex < 0) return [];

  const perkSet = new Set<string>();
  for (let i = 0; i <= planIndex; i += 1) {
    const tier = CONSUMER_PLAN_ORDER[i];
    for (const perk of CONSUMER_PLAN_PERK_DELTAS[tier]) {
      perkSet.add(perk);
    }
  }

  return Array.from(perkSet);
}

export function getConsumerPlanDisplayPerks(planName: string | null | undefined): string[] {
  const normalized = String(planName ?? '').trim().toUpperCase() as ConsumerPlanName;
  const planIndex = CONSUMER_PLAN_ORDER.indexOf(normalized);
  if (planIndex < 0) return [];

  const tierPerks = CONSUMER_PLAN_PERK_DELTAS[normalized] ?? [];
  if (planIndex === 0) {
    return [...tierPerks];
  }

  const previousTier = CONSUMER_PLAN_ORDER[planIndex - 1];
  return [`Everything in ${previousTier}`, ...tierPerks];
}
