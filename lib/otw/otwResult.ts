// lib/otw/otwResult.ts

export type Result<T, E = unknown> = { ok: true; data: T } | { ok: false; error: E };

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function err<E = unknown>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}
