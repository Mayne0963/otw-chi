
const isOtwModeCore = process.env.OTW_MODE === 'core';

const rawFlags = {
  franchise: process.env.NEXT_PUBLIC_FEATURE_FRANCHISE === 'true',
  nip: process.env.NEXT_PUBLIC_FEATURE_NIP === 'true',
  adminZones: process.env.NEXT_PUBLIC_FEATURE_ADMIN_ZONES === 'true',
  pos: process.env.NEXT_PUBLIC_FEATURE_POS === 'true',
  billing: process.env.NEXT_PUBLIC_FEATURE_BILLING === 'true',
  pickupPass: process.env.NEXT_PUBLIC_FEATURE_PICKUP_PASS === 'true',
  chat: process.env.NEXT_PUBLIC_FEATURE_CHAT === 'true',
};

const expansionFlags = {
  franchise: isOtwModeCore ? false : rawFlags.franchise,
  nip: isOtwModeCore ? false : rawFlags.nip,
  adminZones: isOtwModeCore ? false : rawFlags.adminZones,
  pos: isOtwModeCore ? false : rawFlags.pos,
  billing: isOtwModeCore ? false : rawFlags.billing,
};

const coreFlags = {
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
