import { PrismaClient } from '@prisma/client';

type GlobalWithPrisma = typeof globalThis & {
  __OTW_PRISMA__?: PrismaClient;
};

export function getPrisma(): PrismaClient {
  const g = globalThis as GlobalWithPrisma;
  if (g.__OTW_PRISMA__) return g.__OTW_PRISMA__;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing DATABASE_URL');
  }
  const { PrismaNeon } = require('@prisma/adapter-neon');
  const { neon } = require('@neondatabase/serverless');
  const adapter = new PrismaNeon(neon(url));
  const client = new PrismaClient({ adapter } as any);
  g.__OTW_PRISMA__ = client;
  return client;
}
