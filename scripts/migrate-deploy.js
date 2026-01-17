#!/usr/bin/env node

/**
 * This script runs Prisma migrations during Vercel deployment
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const readEnv = (key) => {
  const value = process.env[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('psql ')) {
    const match = trimmed.match(/psql ['"]([^'"]+)['"]/);
    if (match && match[1]) return match[1];
  }
  return trimmed;
};

const pickFirstEnv = (keys) => {
  for (const key of keys) {
    const value = readEnv(key);
    if (value) return { key, value };
  }
  return null;
};

async function runMigrations() {
  console.log('[migrate-deploy] Starting database migrations...');
  
  try {
    const pooled = pickFirstEnv(['DATABASE_URL', 'NEON_DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL']);
    const direct = pickFirstEnv([
      'DIRECT_URL',
      'POSTGRES_URL_NON_POOLING',
      'DATABASE_URL_NON_POOLING',
      'DATABASE_URL_UNPOOLED',
      'NEON_DATABASE_URL_NON_POOLING',
      'NEON_DATABASE_URL_UNPOOLED',
    ]);

    // Check if any database URL is set
    if (!pooled && !direct) {
      console.log(
        '[migrate-deploy] DATABASE_URL/DIRECT_URL (or POSTGRES_*/NEON_* equivalents) not set, skipping migrations'
      );
      process.exit(0);
    }

    const migrationUrl = direct?.value ?? pooled?.value;
    const migrationUrlKey = direct?.key ?? pooled?.key ?? 'DATABASE_URL';
    console.log(`[migrate-deploy] Using ${migrationUrlKey} for migrations`);
    console.log('[migrate-deploy] Running: prisma migrate deploy');
    
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: migrationUrl,
      },
    });

    console.log('[migrate-deploy] stdout:', stdout);
    
    if (stderr) {
      console.error('[migrate-deploy] stderr:', stderr);
    }

    console.log('[migrate-deploy] ✓ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[migrate-deploy] ✗ Migration failed:', error.message);
    
    if (error.stdout) {
      console.log('[migrate-deploy] stdout:', error.stdout);
    }
    
    if (error.stderr) {
      console.error('[migrate-deploy] stderr:', error.stderr);
    }
    
    // Don't fail the build if migrations fail
    // This allows the app to deploy even if migrations have issues
    console.log('[migrate-deploy] Continuing deployment despite migration failure');
    process.exit(0);
  }
}

runMigrations();
