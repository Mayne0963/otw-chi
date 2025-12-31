import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

type GlobalWithPrisma = typeof globalThis & {
  __OTW_PRISMA__?: PrismaClient
}

export function getPrisma(): PrismaClient {
  const g = globalThis as GlobalWithPrisma
  if (g.__OTW_PRISMA__) return g.__OTW_PRISMA__

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    // Graceful fallback: return a stubbed Prisma-like client to avoid 500s
    console.warn('WARN: DATABASE_URL is missing. Using stubbed Prisma client.')
    
    const noop = async (..._args: unknown[]) => null
    const listEmpty = async (..._args: unknown[]) => []
    const countZero = async (..._args: unknown[]) => 0
    const aggregateZero = async (..._args: unknown[]) => ({ _sum: { amount: 0 } })
    
    // Mock objects to return for upsert/create to prevent null property access
    const mockUser = { id: 'stub-user', role: 'CUSTOMER', name: 'Stub User', dob: null, termsAcceptedAt: null }
    const mockProfile = { id: 'stub-profile', userId: 'stub-user' }
    const mockRequest = { id: 'stub-request', status: 'SUBMITTED' }
    const mockDeliveryRequest = {
      id: 'stub-delivery-request',
      status: 'REQUESTED',
      serviceType: 'FOOD',
      pickupAddress: '123 Mock St',
      dropoffAddress: '456 Example Ave',
      notes: null,
      restaurantName: 'Sample Bistro',
      restaurantWebsite: 'https://example.com',
      receiptVendor: 'Sample Bistro',
      receiptLocation: 'Mock City, IN',
      receiptItems: [],
      receiptAuthenticityScore: 0.85,
      receiptImageData: null,
      deliveryFeeCents: 995,
      deliveryFeePaid: true,
    }
    const mockTicket = { id: 'stub-ticket', status: 'OPEN' }
    const mockEvent = { id: 'stub-event' }
    
    const returnMockUser = async (..._args: unknown[]) => mockUser
    const returnMockProfile = async (..._args: unknown[]) => mockProfile
    const returnMockRequest = async (..._args: unknown[]) => mockRequest
    const returnMockDeliveryRequest = async (..._args: unknown[]) => mockDeliveryRequest
    const returnMockTicket = async (..._args: unknown[]) => mockTicket
    const returnMockEvent = async (..._args: unknown[]) => mockEvent

    const stub = {
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
      deliveryRequest: {
        findUnique: noop,
        findFirst: noop,
        findMany: listEmpty,
        update: returnMockDeliveryRequest,
        create: returnMockDeliveryRequest,
        count: countZero,
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
    }
    
    g.__OTW_PRISMA__ = stub as unknown as PrismaClient
    return g.__OTW_PRISMA__
  }

  // Create Neon adapter for Prisma 7
  const adapter = new PrismaNeon({ connectionString })
  const client = new PrismaClient({ adapter })
  
  g.__OTW_PRISMA__ = client
  return client
}

// Export singleton instance
export const prisma = getPrisma()
export default prisma
