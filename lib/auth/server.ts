import { createNeonAuth } from '@neondatabase/auth/next/server';

const baseUrl =
  process.env.NEON_AUTH_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

if (!baseUrl) {
  throw new Error(
    'Missing NEON_AUTH_BASE_URL or NEXT_PUBLIC_APP_URL environment variable.'
  );
}

if (!process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error('Missing NEON_AUTH_COOKIE_SECRET environment variable.');
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
  },
});

export async function getNeonSession() {
  try {
    const session = await auth.getSession();
    return session?.data || null;
  } catch (error) {
    console.error('Neon Auth Error:', error);
    return null;
  }
}
