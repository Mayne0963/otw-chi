// Script to validate environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_APP_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_BASIC',
  'STRIPE_PRICE_PLUS',
  'STRIPE_PRICE_EXEC',
];

export function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      '❌ Missing required environment variables:\n' +
        missing.map((key) => `   - ${key}`).join('\n')
    );
    // In strict mode, you might want to throw an error here to fail the build
    // throw new Error('Missing required environment variables');
  } else {
    console.log('✅ All required environment variables are set.');
  }
}

import { fileURLToPath } from 'url';

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateEnv();
}
