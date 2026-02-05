
import 'dotenv/config';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Load .env.local if it exists
if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
  const envConfig = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env.local')));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

// Setup Neon adapter for script usage
neonConfig.webSocketConstructor = ws;

const DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL',
  'DIRECT_URL',
  'DATABASE_URL_NON_POOLING',
  'DATABASE_URL_UNPOOLED',
  'NEON_DATABASE_URL_NON_POOLING',
  'NEON_DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
];

function getDatabaseUrl() {
  for (const key of DATABASE_URL_KEYS) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  throw new Error(`Missing database connection string. Set one of: ${DATABASE_URL_KEYS.join(', ')}`);
}

function getPrismaClient() {
  const connectionString = getDatabaseUrl();

  // Create Neon adapter for Prisma 7
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

async function fixCoupon() {
  const prisma = getPrismaClient();
  // The user clarified the code is ZAFJDE5E (with a 5), not ZAFJDESE (with an S)
  const correctCode = 'ZAFJDE5E';
  const wrongCode = 'ZAFJDESE';

  console.log(`Fixing coupon. creating ${correctCode}...`);

  // 1. Create the correct coupon
  const coupon = await prisma.promoCode.upsert({
    where: { code: correctCode },
    update: { 
        active: true,
        percentOff: 50, // Assuming 50% as before
        maxRedemptions: 1000 
    },
    create: {
      code: correctCode,
      active: true,
      percentOff: 50,
      maxRedemptions: 1000,
      startsAt: new Date(),
    },
  });

  console.log('✅ Created/Updated correct coupon:', coupon);

  // 2. Optionally clean up the wrong one if it exists, or leave it. 
  // Let's leave it just in case, or maybe disable it? 
  // User didn't ask to remove the other one, but to make this one work.
  // I'll leave the S version alone to be safe, or just in case they try both.
}

fixCoupon()
  .catch((e) => {
    console.error('Error fixing coupon:', e);
    process.exit(1);
  });
