import { createNeonAuth } from '@neondatabase/auth/next/server';

const neonAuthUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

if (!neonAuthUrl) {
  throw new Error('NEXT_PUBLIC_NEON_AUTH_URL is not set');
}

if (!cookieSecret) {
  // In development, we can warn, but for now we'll throw to ensure it's set up correctly.
  // If you are in local dev and don't have one, run: openssl rand -base64 32
  throw new Error('NEON_AUTH_COOKIE_SECRET is not set. Please add it to your environment variables.');
}

export const neonAuth = createNeonAuth({
  baseUrl: neonAuthUrl,
  cookies: {
    secret: cookieSecret,
  },
});

export async function getNeonSession() {
  try {
    const { data } = await neonAuth.getSession();
    return data;
  } catch (error) {
    console.error('Neon Auth Error:', error);
    return null;
  }
}
