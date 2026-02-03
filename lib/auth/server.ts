import { createNeonAuth } from '@neondatabase/auth/next/server';

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
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
