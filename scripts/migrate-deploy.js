#!/usr/bin/env node

/**
 * This script runs Prisma migrations during Vercel deployment
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runMigrations() {
  console.log('[migrate-deploy] Starting database migrations...');
  
  try {
    // Check if DATABASE_URL and DIRECT_URL are set
    if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
      console.log('[migrate-deploy] DATABASE_URL or DIRECT_URL not set, skipping migrations');
      process.exit(0);
    }

    console.log('[migrate-deploy] Running: prisma migrate deploy');
    
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL,
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
