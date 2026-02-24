export type FeatureName = 'franchise' | 'nip' | 'adminZones' | 'pos';
export type OtwMode = 'core' | 'expansion';

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

function parseOtwMode(value: string | undefined): OtwMode {
  if (typeof value !== 'string') return 'core';
  return value.trim().toLowerCase() === 'expansion' ? 'expansion' : 'core';
}

const CORE_DISABLED_FLAGS: FeatureMap = {
  franchise: false,
  nip: false,
  adminZones: false,
  pos: false,
};

const CLIENT_MODE = parseOtwMode(process.env.NEXT_PUBLIC_OTW_MODE);
const SERVER_MODE = parseOtwMode(process.env.OTW_MODE ?? process.env.NEXT_PUBLIC_OTW_MODE);

const RAW_FEATURE_FLAGS: FeatureMap = {
  franchise: parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_FRANCHISE, false),
  nip: parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_NIP, false),
  adminZones: parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_ADMIN_ZONES, false),
  pos: parseFeatureFlag(process.env.NEXT_PUBLIC_FEATURE_POS, false),
};

function applyMode(mode: OtwMode, flags: FeatureMap): FeatureMap {
  if (mode === 'core') return CORE_DISABLED_FLAGS;
  return flags;
}

const FEATURE_FLAGS = applyMode(CLIENT_MODE, RAW_FEATURE_FLAGS);
const SERVER_FEATURE_FLAGS = applyMode(SERVER_MODE, RAW_FEATURE_FLAGS);

export function isFeatureEnabled(feature: FeatureName): boolean {
  return FEATURE_FLAGS[feature];
}

export function isServerFeatureEnabled(feature: FeatureName): boolean {
  return SERVER_FEATURE_FLAGS[feature];
}

export function getFeatureFlags(): Readonly<FeatureMap> {
  return FEATURE_FLAGS;
}

export function getServerFeatureFlags(): Readonly<FeatureMap> {
  return SERVER_FEATURE_FLAGS;
}

export function getOtwMode(): OtwMode {
  return CLIENT_MODE;
}

export function getServerOtwMode(): OtwMode {
  return SERVER_MODE;
}
