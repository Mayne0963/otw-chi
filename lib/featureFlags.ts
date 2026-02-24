
const isOtwModeCore = process.env.OTW_MODE === 'core';

const rawFlags = {
  franchise: process.env.NEXT_PUBLIC_FEATURE_FRANCHISE === 'true',
  nip: process.env.NEXT_PUBLIC_FEATURE_NIP === 'true',
  adminZones: process.env.NEXT_PUBLIC_FEATURE_ADMIN_ZONES === 'true',
  pos: process.env.NEXT_PUBLIC_FEATURE_POS === 'true',
  billing: process.env.NEXT_PUBLIC_FEATURE_BILLING === 'true',
};

const expansionFlags = {
  franchise: isOtwModeCore ? false : rawFlags.franchise,
  nip: isOtwModeCore ? false : rawFlags.nip,
  adminZones: isOtwModeCore ? false : rawFlags.adminZones,
  pos: isOtwModeCore ? false : rawFlags.pos,
  billing: isOtwModeCore ? false : rawFlags.billing,
};

export const serverFeatureFlags = {
  ...expansionFlags,
  // Add any server-only flags here
};

export const clientFeatureFlags = {
  ...expansionFlags,
};

export const getFeatureFlags = (isServer: boolean) => {
  return isServer ? serverFeatureFlags : clientFeatureFlags;
};
