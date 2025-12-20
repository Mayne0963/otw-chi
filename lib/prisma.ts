import { PrismaClient } from '@prisma/client';

type GlobalWithPrisma = typeof globalThis & {
  __PRISMA__?: PrismaClient;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const { PrismaNeon } = require('@prisma/adapter-neon');
  const { neon } = require('@neondatabase/serverless');
  const adapter = new PrismaNeon(neon(url));
  return new PrismaClient({ adapter } as any);
}

export const prisma = globalForPrisma.__PRISMA__ ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.__PRISMA__ = prisma;

export default prisma;
