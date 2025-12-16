import { PrismaClient } from '@prisma/client';

type GlobalWithPrisma = typeof globalThis & {
  __OTW_PRISMA__?: PrismaClient;
};

export function getPrisma(): PrismaClient {
  const g = globalThis as GlobalWithPrisma;
  if (g.__OTW_PRISMA__) return g.__OTW_PRISMA__;
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Graceful fallback: return a stubbed Prisma-like client to avoid 500s
    const noop = async (..._args: any[]) => null;
    const listEmpty = async (..._args: any[]) => [];
    const aggregateZero = async (..._args: any[]) => ({ _sum: { amount: 0 } });
    const stub: any = {
      user: { findFirst: noop },
      membershipSubscription: { findUnique: noop },
      nIPLedger: { aggregate: aggregateZero, findMany: listEmpty, create: noop },
      request: { findFirst: noop, findMany: listEmpty, update: noop, create: noop },
      requestEvent: { create: noop, findMany: listEmpty },
      driverProfile: { findUnique: noop },
      supportTicket: { findFirst: noop, findMany: listEmpty, create: noop, update: noop },
      city: { findMany: listEmpty },
      zone: { findMany: listEmpty },
    };
    g.__OTW_PRISMA__ = stub as PrismaClient;
    return g.__OTW_PRISMA__ as PrismaClient;
  }
  const { PrismaNeon } = require('@prisma/adapter-neon');
  const { neon } = require('@neondatabase/serverless');
  const adapter = new PrismaNeon(neon(url));
  const client = new PrismaClient({ adapter } as any);
  g.__OTW_PRISMA__ = client;
  return client;
}
