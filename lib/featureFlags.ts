export type FeatureName = 'franchise' | 'nip' | 'adminZones' | 'pos';

type FeatureMap = Record<FeatureName, boolean>;

function parseFeatureFlag(value: string | undefined, defaultValue = false): boolean {
  if (typeof value !== 'string') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return defaultValue;
}

const FEATURE_FLAGS: FeatureMap = {
  franchise: parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_FRANCHISE, false),
  nip: parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_NIP, false),
  adminZones: parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_ADMIN_ZONES, false),
  pos: parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_POS, false),
};

export function isFeatureEnabled(feature: FeatureName): boolean {
  return FEATURE_FLAGS[feature];
}

export function isServerFeatureEnabled(feature: FeatureName): boolean {
  return FEATURE_FLAGS[feature];
}

export function getFeatureFlags(): Readonly<FeatureMap> {
  return FEATURE_FLAGS;
}
