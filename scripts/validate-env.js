import 'dotenv/config'

// Script to validate environment variables
const requiredDbEnvVars = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEON_DATABASE_URL',
  'NEON_DATABASE_URL_NON_POOLING',
  'NEON_DATABASE_URL_UNPOOLED',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL_NON_POOLING',
  'DATABASE_URL_UNPOOLED',
];

const requiredEnvVars = [
  'NEON_AUTH_BASE_URL',
  'NEON_AUTH_COOKIE_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_BASIC',
  'STRIPE_PRICE_PLUS',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_ELITE',
  'STRIPE_PRICE_BLACK',
  'NEXT_PUBLIC_HCAPTCHA_SITE_KEY',
  'HCAPTCHA_SECRET_KEY',
];

export function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  const hasDbUrl = requiredDbEnvVars.some((key) => Boolean(process.env[key]));
  if (!hasDbUrl) {
    missing.unshift(
      `DATABASE_URL (or one of: ${requiredDbEnvVars.filter((k) => k !== 'DATABASE_URL').join(', ')})`
    );
  }

  if (missing.length > 0) {
    console.error(
      '❌ Missing required environment variables:\n' +
        missing.map((key) => `   - ${key}`).join('\n')
    );
    // In strict mode, you might want to throw an error here to fail the build
    if (process.env.CI) {
      throw new Error('Missing required environment variables in CI/Production build');
    }
  } else {
    console.log('✅ All required environment variables are set.');
  }
}

import { fileURLToPath } from 'url';

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateEnv();
}
