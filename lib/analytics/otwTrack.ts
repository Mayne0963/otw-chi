'use client';

export type OtwServiceType =
  | 'FOOD_DELIVERY'
  | 'STORE_PICKUP'
  | 'FRAGILE_ITEM'
  | 'PERSONAL_ERRAND'
  | 'RIDE_SERVICE'
  | 'PEER_TO_PEER'
  | 'EVENT_SUPPORT'
  | 'HOME_WAIT_SERVICE'
  | 'OTHER';

export type OtwSiteEventType =
  | 'PAGE_VIEW'
  | 'CTA_CLICK'
  | 'SERVICE_VIEW'
  | 'SERVICE_SELECTED'
  | 'REQUEST_STARTED'
  | 'REQUEST_STEP_COMPLETED'
  | 'REQUEST_SUBMITTED'
  | 'REQUEST_ABANDONED_SIGNAL'
  | 'MEMBERSHIP_VIEW'
  | 'MEMBERSHIP_SELECTED'
  | 'MEMBERSHIP_CHECKOUT_STARTED'
  | 'MEMBERSHIP_CHECKOUT_COMPLETED'
  | 'LOGIN_REQUIRED'
  | 'DRIVER_APPLICATION_STARTED'
  | 'DRIVER_APPLICATION_SUBMITTED'
  | 'CONTACT_SUBMITTED'
  | 'SUPPORT_CLICKED'
  | 'ERROR_SHOWN';

type MetadataValue = string | number | boolean | null;
export type OtwEventMetadata = Record<string, MetadataValue>;

export type TrackOtwEventOptions = {
  page?: string;
  serviceType?: OtwServiceType;
  metadata?: Record<string, unknown>;
};

const CONSENT_KEY = 'otw_cookie_consent';
const SESSION_ID_KEY = 'otw_session_id';

let ephemeralSessionId: string | null = null;

function hasCookieConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

function readStorageValue(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    return value && value.trim().length > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors (Safari private mode, etc.)
  }
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

export function getOtwSessionId(): string {
  // If consented, store a stable session id in localStorage for correlation.
  if (hasCookieConsent()) {
    const existing = readStorageValue(SESSION_ID_KEY);
    if (existing) return existing;
    const created = generateSessionId();
    writeStorageValue(SESSION_ID_KEY, created);
    return created;
  }

  // Without consent, use an ephemeral session id for this page load only.
  if (ephemeralSessionId) return ephemeralSessionId;
  ephemeralSessionId = generateSessionId();
  return ephemeralSessionId;
}

function shouldDropMetadataKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return (
    lowered.includes('card') ||
    lowered.includes('cvc') ||
    lowered.includes('cvv') ||
    lowered.includes('stripe') ||
    lowered.includes('secret') ||
    lowered.includes('password') ||
    lowered.includes('token') ||
    lowered.includes('paymentmethod') ||
    lowered.includes('payment_method') ||
    lowered.includes('clientsecret') ||
    lowered.includes('client_secret')
  );
}

function normalizeMetadataValue(value: unknown): MetadataValue | null {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > 400 ? trimmed.slice(0, 400) : trimmed;
  }
  return null;
}

export function sanitizeOtwEventMetadata(input: unknown): OtwEventMetadata {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const out: OtwEventMetadata = {};
  const entries = Object.entries(raw).slice(0, 30);

  for (const [key, value] of entries) {
    const safeKey = typeof key === 'string' ? key.trim().slice(0, 60) : '';
    if (!safeKey) continue;
    if (shouldDropMetadataKey(safeKey)) continue;
    const normalized = normalizeMetadataValue(value);
    if (normalized === null) continue;
    out[safeKey] = normalized;
  }

  return out;
}

export async function trackOtwEvent(eventType: OtwSiteEventType, options?: TrackOtwEventOptions) {
  try {
    const sessionId = getOtwSessionId();
    const page = options?.page ?? window.location.pathname;
    const metadata = sanitizeOtwEventMetadata(options?.metadata);

    await fetch('/api/otw/site-events', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        eventType,
        page,
        serviceType: options?.serviceType ?? null,
        metadata,
      }),
    });
  } catch {
    // Analytics must never break UX.
  }
}
