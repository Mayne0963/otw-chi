
import { serverFeatureFlags, clientFeatureFlags } from './featureFlags';

interface PlanConfig {
  overageBillingMode?: string;
}

interface CapabilitiesProps {
  role?: string;
  planName?: string;
  planConfig?: PlanConfig;
  isServer?: boolean;
}

const getCapabilities = ({ 
  role, 
  planName, 
  planConfig, 
  isServer = false 
}: CapabilitiesProps) => {
  const flags = isServer ? serverFeatureFlags : clientFeatureFlags;

  // Core capabilities
  const canUseInvoiceOverage = planConfig?.overageBillingMode === 'INVOICE';
  const canUsePrioritySlot = planName === 'Elite' || planName === 'Black';

  // Expansion capabilities (gated by feature flags)
  const canSeeFranchise = flags.franchise && role === 'ADMIN';
  const canSeeNip = flags.nip;
  const canSeeAdminZones = flags.adminZones && role === 'ADMIN';
  const canSeePos = flags.pos;
  const canSeeBilling = flags.billing;

  return {
    canSeeFranchise,
    canSeeNip,
    canSeeAdminZones,
    canSeePos,
    canSeeBilling,
    canUseInvoiceOverage,
    canUsePrioritySlot,
  };
};

export const getServerCapabilities = (props: Omit<CapabilitiesProps, 'isServer'> = {}) => {
  return getCapabilities({ ...props, isServer: true });
};

export const getClientCapabilities = (props: Omit<CapabilitiesProps, 'isServer'> = {}) => {
  return getCapabilities({ ...props, isServer: false });
};
