import {
  type FeatureName,
  type OtwMode,
  getFeatureFlags,
  getOtwMode,
  getServerFeatureFlags,
  getServerOtwMode,
} from '@/lib/featureFlags';

type FlagsInput = Partial<Record<FeatureName, boolean>>;

type PlanConfigInput = {
  overageBillingMode?: string | null;
} | null | undefined;

export type Capabilities = {
  canSeeFranchise: boolean;
  canSeeNip: boolean;
  canSeeAdminZones: boolean;
  canSeePos: boolean;
  canUseInvoiceOverage: boolean;
  canUsePrioritySlot: boolean;
};

export type GetCapabilitiesInput = {
  role?: string | null;
  planName?: string | null;
  planConfig?: PlanConfigInput;
  flags?: FlagsInput;
  mode?: OtwMode;
};

function normalizeMode(mode: OtwMode | undefined): OtwMode {
  return mode === 'expansion' ? 'expansion' : 'core';
}

function normalizeFlag(value: unknown): boolean {
  return value === true;
}

function hasPrioritySlot(planName: string | null | undefined): boolean {
  if (!planName) return false;
  const normalized = planName.trim().toUpperCase();
  return normalized === 'OTW ELITE' || normalized === 'OTW BLACK';
}

function canInvoiceOverage(planConfig: PlanConfigInput): boolean {
  const mode = String(planConfig?.overageBillingMode ?? '').trim().toUpperCase();
  return mode === 'INVOICE';
}

export function getCapabilities(input: GetCapabilitiesInput = {}): Capabilities {
  const mode = normalizeMode(input.mode);
  const flags = input.flags ?? {};
  const expansionEnabled = mode === 'expansion';

  const canSeeFranchise = expansionEnabled && normalizeFlag(flags.franchise);
  const canSeeNip = expansionEnabled && normalizeFlag(flags.nip);
  const canSeeAdminZones = expansionEnabled && normalizeFlag(flags.adminZones);
  const canSeePos = expansionEnabled && normalizeFlag(flags.pos);

  return {
    canSeeFranchise,
    canSeeNip,
    canSeeAdminZones,
    canSeePos,
    canUseInvoiceOverage: canInvoiceOverage(input.planConfig),
    canUsePrioritySlot: hasPrioritySlot(input.planName),
  };
}

export function getClientCapabilities(
  input: Omit<GetCapabilitiesInput, 'flags' | 'mode'> & { flags?: FlagsInput } = {}
): Capabilities {
  return getCapabilities({
    ...input,
    mode: getOtwMode(),
    flags: input.flags ?? getFeatureFlags(),
  });
}

export function getServerCapabilities(
  input: Omit<GetCapabilitiesInput, 'flags' | 'mode'> & { flags?: FlagsInput } = {}
): Capabilities {
  return getCapabilities({
    ...input,
    mode: getServerOtwMode(),
    flags: input.flags ?? getServerFeatureFlags(),
  });
}
