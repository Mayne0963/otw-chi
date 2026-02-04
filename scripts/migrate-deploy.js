#!/usr/bin/env node

/**
 * This script runs Prisma migrations during Vercel deployment
 */

import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const parsePositiveInt = (raw, fallback) => {
  if (typeof raw !== 'string') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
};

const parseBoolean = (raw) => {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return null;
};

const isQuotaExceededError = (text) => {
  if (typeof text !== 'string' || !text) return false;
  const haystack = text.toLowerCase();
  return (
    haystack.includes('exceeded the data transfer quota') ||
    haystack.includes('data transfer quota') ||
    haystack.includes('quota') && haystack.includes('exceeded')
  );
};

const isRetryableMigrationError = (text) => {
  if (typeof text !== 'string' || !text) return false;
  const haystack = text.toLowerCase();
  return (
    haystack.includes('pg_advisory_lock') ||
    haystack.includes('advisory lock') ||
    haystack.includes('migrate-advisory-locking') ||
    haystack.includes('p1001') ||
    haystack.includes('p1002') ||
    haystack.includes('the database server was reached but timed out') ||
    haystack.includes('econnreset') ||
    haystack.includes('etimedout') ||
    haystack.includes('connection terminated unexpectedly')
  );
};

const isAdvisoryLockTimeout = (text) => {
  if (typeof text !== 'string' || !text) return false;
  const haystack = text.toLowerCase();
  return (
    haystack.includes('pg_advisory_lock') ||
    haystack.includes('advisory lock') ||
    haystack.includes('migrate-advisory-locking')
  );
};

const extractFailedMigrationName = (text) => {
  if (typeof text !== 'string') return null;
  const byLabel = text.match(/Migration name:\s*([0-9]{14}_[a-zA-Z0-9_\\-]+)/);
  if (byLabel?.[1]) return byLabel[1];

  const byBackticks = text.match(/The\s+`([0-9]{14}_[a-zA-Z0-9_\\-]+)`\s+migration/i);
  if (byBackticks?.[1]) return byBackticks[1];

  const byQuotes = text.match(/The\s+['"]([0-9]{14}_[a-zA-Z0-9_\\-]+)['"]\s+migration/i);
  if (byQuotes?.[1]) return byQuotes[1];

  return null;
};

const shouldAutoRollbackFailedMigration = (migrationName, combinedOutput) => {
  if (!migrationName) return false;
  if (migrationName !== '20260124190000_add_service_miles_economy') return false;
  const haystack = String(combinedOutput || '').toLowerCase();
  return haystack.includes('p3018') || haystack.includes('p3009');
};

async function runMigrations() {
  console.log('[migrate-deploy] Starting database migrations...');

  const skipMigrations = parseBoolean(process.env.SKIP_MIGRATIONS) ?? false;
  if (skipMigrations) {
    console.log('[migrate-deploy] SKIP_MIGRATIONS enabled, skipping migrations');
    process.exit(0);
  }

  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    console.log('[migrate-deploy] Non-production Vercel build detected, skipping migrations');
    process.exit(0);
  }
  
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

  let migrationUrl = direct?.value ?? pooled?.value;
  const migrationUrlKey = direct?.key ?? pooled?.key ?? 'DATABASE_URL';
  console.log(`[migrate-deploy] Using ${migrationUrlKey} for migrations`);

  // ENHANCEMENT: Append timeout settings if missing to prevent P1002 (Connection Timeout)
  if (migrationUrl && !migrationUrl.includes('connect_timeout')) {
      const separator = migrationUrl.includes('?') ? '&' : '?';
      migrationUrl = `${migrationUrl}${separator}connect_timeout=300&pool_timeout=300`;
      console.log(`[migrate-deploy] Added connection timeouts to ${migrationUrlKey} to prevent P1002`);
  }

  const maxAttempts = parsePositiveInt(process.env.PRISMA_MIGRATE_DEPLOY_MAX_ATTEMPTS, 7);
  const initialBackoffMs = parsePositiveInt(process.env.PRISMA_MIGRATE_DEPLOY_INITIAL_BACKOFF_MS, 2000);
  const maxBackoffMs = parsePositiveInt(process.env.PRISMA_MIGRATE_DEPLOY_MAX_BACKOFF_MS, 60_000);
  const allowFailure = parseBoolean(process.env.PRISMA_MIGRATE_DEPLOY_ALLOW_FAILURE) ?? false;
  const requireSuccess = parseBoolean(process.env.PRISMA_MIGRATE_DEPLOY_REQUIRE_SUCCESS) ?? false;

  let backoffMs = initialBackoffMs;
  let disableAdvisoryLock = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`[migrate-deploy] Running: prisma migrate deploy (attempt ${attempt}/${maxAttempts})`);
    if (disableAdvisoryLock) {
      console.log('[migrate-deploy] Note: Advisory locking is DISABLED for this attempt');
    }

    try {
      const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
        env: {
          ...process.env,
          DATABASE_URL: migrationUrl,
          ...(disableAdvisoryLock ? { PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1' } : {}),
        },
        maxBuffer: 10 * 1024 * 1024,
      });

      console.log('[migrate-deploy] stdout:', stdout);

      if (stderr) {
        console.error('[migrate-deploy] stderr:', stderr);
      }

      console.log('[migrate-deploy] ✓ Migrations completed successfully');
      process.exit(0);
    } catch (error) {
      const message = error?.message ? String(error.message) : 'Unknown error';
      const stdout = error?.stdout ? String(error.stdout) : '';
      const stderr = error?.stderr ? String(error.stderr) : '';

      console.error('[migrate-deploy] ✗ Migration failed:', message);
      if (stdout) console.log('[migrate-deploy] stdout:', stdout);
      if (stderr) console.error('[migrate-deploy] stderr:', stderr);

      const combined = [message, stdout, stderr].filter(Boolean).join('\n');
      const failedMigrationName = extractFailedMigrationName(combined);
      
      console.log('[migrate-deploy] Checking if error is retryable...');

      if (isQuotaExceededError(combined) && !requireSuccess) {
        console.log(
          '[migrate-deploy] Database quota exceeded. Skipping migrations to allow build to continue.'
        );
        process.exit(0);
      }

      if (shouldAutoRollbackFailedMigration(failedMigrationName, combined)) {
        console.log(`[migrate-deploy] Auto-recovering failed migration ${failedMigrationName} with migrate resolve...`);
        try {
          const { stdout: resolveStdout, stderr: resolveStderr } = await execAsync(
            `npx prisma migrate resolve --rolled-back "${failedMigrationName}"`,
            {
              env: {
                ...process.env,
                DATABASE_URL: migrationUrl,
              },
              maxBuffer: 10 * 1024 * 1024,
            }
          );
          if (resolveStdout) console.log('[migrate-deploy] resolve stdout:', resolveStdout);
          if (resolveStderr) console.error('[migrate-deploy] resolve stderr:', resolveStderr);
          console.log('[migrate-deploy] ✓ Marked failed migration as rolled back; retrying deploy...');
          await sleep(Math.min(backoffMs, 5_000));
          continue;
        } catch (resolveError) {
          const resolveMessage = resolveError?.message ? String(resolveError.message) : 'Unknown resolve error';
          const resolveOut = resolveError?.stdout ? String(resolveError.stdout) : '';
          const resolveErr = resolveError?.stderr ? String(resolveError.stderr) : '';
          console.error('[migrate-deploy] ✗ Auto-rollback failed:', resolveMessage);
          if (resolveOut) console.log('[migrate-deploy] resolve stdout:', resolveOut);
          if (resolveErr) console.error('[migrate-deploy] resolve stderr:', resolveErr);
        }
      }

      const retryable = isRetryableMigrationError(combined);
      const hasAttemptsRemaining = attempt < maxAttempts;

      if (retryable && hasAttemptsRemaining) {
        if (!disableAdvisoryLock && isAdvisoryLockTimeout(combined)) {
          disableAdvisoryLock = true;
          console.log('[migrate-deploy] Advisory lock timeout detected; retrying with advisory locking disabled');
        }
        const seconds = Math.max(1, Math.round(backoffMs / 1000));
        console.log(`[migrate-deploy] Transient error detected; retrying in ${seconds}s...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
        continue;
      }

      if (allowFailure) {
        console.log('[migrate-deploy] Continuing deployment despite migration failure');
        process.exit(0);
      }

      process.exit(1);
    }
  }
}

runMigrations();
