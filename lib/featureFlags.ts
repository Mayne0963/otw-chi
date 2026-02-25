const isOtwModeCore = String(process.env.OTW_MODE ?? '').trim().toLowerCase() === 'core';

function parseFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return defaultValue;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  return defaultValue;
}

const rawFlags = {
  franchise: parseFlag('NEXT_PUBLIC_FEATURE_FRANCHISE', false),
  nip: parseFlag('NEXT_PUBLIC_FEATURE_NIP', false),
  adminZones: parseFlag('NEXT_PUBLIC_FEATURE_ADMIN_ZONES', false),
  pos: parseFlag('NEXT_PUBLIC_FEATURE_POS', false),
  billing: parseFlag('NEXT_PUBLIC_FEATURE_BILLING', false),
  receipts: parseFlag('NEXT_PUBLIC_FEATURE_RECEIPTS', false),
  // Core MVP defaults to enabled unless explicitly set to false.
  pickupPass: parseFlag('NEXT_PUBLIC_FEATURE_PICKUP_PASS', true),
  chat: parseFlag('NEXT_PUBLIC_FEATURE_CHAT', true),
};

const expansionFlags = {
  franchise: isOtwModeCore ? false : rawFlags.franchise,
  nip: isOtwModeCore ? false : rawFlags.nip,
  adminZones: isOtwModeCore ? false : rawFlags.adminZones,
  pos: isOtwModeCore ? false : rawFlags.pos,
  billing: isOtwModeCore ? false : rawFlags.billing,
};

const coreFlags = {
  receipts: isOtwModeCore ? false : rawFlags.receipts,
  pickupPass: rawFlags.pickupPass,
  chat: rawFlags.chat,
};

export const serverFeatureFlags = {
  ...coreFlags,
  ...expansionFlags,
  // Add any server-only flags here
};

export const clientFeatureFlags = {
  ...coreFlags,
  ...expansionFlags,
};

export const getFeatureFlags = (isServer: boolean) => {
  return isServer ? serverFeatureFlags : clientFeatureFlags;
};
