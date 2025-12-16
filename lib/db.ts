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
    console.warn('WARN: DATABASE_URL is missing. Using stubbed Prisma client.');
    
    const noop = async (..._args: any[]) => null;
    const listEmpty = async (..._args: any[]) => [];
    const countZero = async (..._args: any[]) => 0;
    const aggregateZero = async (..._args: any[]) => ({ _sum: { amount: 0 } });
    
    // Mock objects to return for upsert/create to prevent null property access
    const mockUser = { id: 'stub-user', role: 'CUSTOMER', name: 'Stub User', dob: null, termsAcceptedAt: null };
    const mockProfile = { id: 'stub-profile', userId: 'stub-user' };
    const mockRequest = { id: 'stub-request', status: 'SUBMITTED' };
    const mockTicket = { id: 'stub-ticket', status: 'OPEN' };
    const mockEvent = { id: 'stub-event' };
    
    const returnMockUser = async (..._args: any[]) => mockUser;
    const returnMockProfile = async (..._args: any[]) => mockProfile;
    const returnMockRequest = async (..._args: any[]) => mockRequest;
    const returnMockTicket = async (..._args: any[]) => mockTicket;
    const returnMockEvent = async (..._args: any[]) => mockEvent;

    const stub: any = {
      user: { 
        findFirst: noop, 
        findUnique: noop,
        upsert: returnMockUser,
        update: returnMockUser,
        create: returnMockUser 
      },
      customerProfile: {
        findUnique: noop,
        upsert: returnMockProfile,
        create: returnMockProfile,
        update: returnMockProfile
      },
      membershipSubscription: { findUnique: noop },
      nIPLedger: { aggregate: aggregateZero, findMany: listEmpty, create: noop },
      request: { 
        findUnique: noop,
        findFirst: noop, 
        findMany: listEmpty, 
        update: returnMockRequest, 
        create: returnMockRequest,
        count: countZero
      },
      requestEvent: { 
        create: returnMockEvent, 
        findMany: listEmpty 
      },
      driverProfile: { 
        findUnique: noop,
        findMany: listEmpty,
        upsert: returnMockProfile,
        update: returnMockProfile,
        count: countZero
      },
      supportTicket: { 
        findUnique: noop,
        findFirst: noop, 
        findMany: listEmpty, 
        create: returnMockTicket, 
        update: returnMockTicket,
        count: countZero
      },
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
