import { createNeonAuth } from '@neondatabase/auth/next/server';

const baseUrl = process.env.NEON_AUTH_BASE_URL;

if (!baseUrl) {
  throw new Error('Missing NEON_AUTH_BASE_URL environment variable.');
}

if (!process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error('Missing NEON_AUTH_COOKIE_SECRET environment variable.');
}

if (process.env.NEON_AUTH_COOKIE_SECRET.length < 32) {
  throw new Error('NEON_AUTH_COOKIE_SECRET must be at least 32 characters long.');
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
  },
});

type AnyRecord = Record<string, unknown>;

const asNonEmptyString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

export function extractNeonAuthUserId(sessionData: unknown): string | null {
  if (!sessionData || typeof sessionData !== 'object') return null;
  const data = sessionData as AnyRecord;
  const user = (data.user && typeof data.user === 'object' ? data.user : {}) as AnyRecord;
  const metadata = (data.metadata && typeof data.metadata === 'object' ? data.metadata : {}) as AnyRecord;
  const claims = (data.sessionClaims && typeof data.sessionClaims === 'object' ? data.sessionClaims : {}) as AnyRecord;

  return (
    asNonEmptyString(data.userId) ??
    asNonEmptyString(user.id) ??
    asNonEmptyString(metadata.neonAuthUserId) ??
    asNonEmptyString(claims.sub) ??
    null
  );
}

export function extractNeonAuthEmail(sessionData: unknown): string | null {
  if (!sessionData || typeof sessionData !== 'object') return null;
  const data = sessionData as AnyRecord;
  const user = (data.user && typeof data.user === 'object' ? data.user : {}) as AnyRecord;
  const claims = (data.sessionClaims && typeof data.sessionClaims === 'object' ? data.sessionClaims : {}) as AnyRecord;

  return (
    asNonEmptyString(user.email) ??
    asNonEmptyString(data.email) ??
    asNonEmptyString(claims.email) ??
    null
  );
}

function normalizeSessionData(sessionData: unknown): unknown {
  if (!sessionData || typeof sessionData !== 'object') return sessionData;
  const data = sessionData as AnyRecord;
  const normalizedUserId = extractNeonAuthUserId(data);
  const normalizedEmail = extractNeonAuthEmail(data);
  const user = (data.user && typeof data.user === 'object' ? data.user : {}) as AnyRecord;

  return {
    ...data,
    ...(normalizedUserId ? { userId: normalizedUserId } : {}),
    user: {
      ...user,
      ...(normalizedUserId ? { id: asNonEmptyString(user.id) ?? normalizedUserId } : {}),
      ...(normalizedEmail ? { email: asNonEmptyString(user.email) ?? normalizedEmail } : {}),
    },
  };
}

export async function getNeonSession(cookies?: any) {
  try {
    const session = await auth.getSession({ fetchOptions: { headers: { cookie: cookies.toString() } } });
    if (!session?.data) return null;
    return normalizeSessionData(session.data);
  } catch (error) {
    console.error('Neon Auth Error:', error);
    return null;
  }
}
