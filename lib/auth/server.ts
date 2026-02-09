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
  // @ts-ignore: Captcha config is missing from types but required
  captcha: {
    provider: 'hcaptcha',
    secretKey: process.env.HCAPTCHA_SECRET_KEY!,
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
