// lib/otw/otwIds.ts

// Strongly-typed ID aliases (replace with branded types later if desired).
export type OtwTierId = string;
export type OtwCustomerId = string;
export type OtwDriverId = string;
export type OtwRequestId = string;
export type OtwLedgerId = string;

// Generate a new Tier ID. In production this would be stable and generated server-side.
export function newTierId(): OtwTierId {
  return `tier_${Math.random().toString(36).slice(2, 10)}`;
}

export function newRequestId(): OtwRequestId {
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

export function newDriverId(): OtwDriverId {
  return `drv_${Math.random().toString(36).slice(2, 10)}`;
}

export function newLedgerId(): OtwLedgerId {
  return `led_${Math.random().toString(36).slice(2, 10)}`;
}
