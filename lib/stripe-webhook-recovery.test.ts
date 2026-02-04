import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../app/api/stripe/webhook/route';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

// Mock the modules first
vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (key: string) => {
      if (key === 'Stripe-Signature') return 'mock-signature';
      return null;
    },
  }),
}));

vi.mock('next/server', () => ({
  NextResponse: class {
    constructor(body: any, init: any) {
      // @ts-ignore
      this.body = body;
      // @ts-ignore
      this.status = init?.status || 200;
    }
  },
}));

vi.mock('@/lib/db', () => ({
  getPrisma: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(),
  constructStripeEvent: (body: string) => JSON.parse(body),
}));

describe('Stripe Webhook - Plan Resolution Recovery', () => {
  const mockPrisma = {
    membershipSubscription: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    membershipPlan: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    serviceMilesWallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    serviceMilesLedger: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => await callback(mockPrisma)),
  };

  const mockStripeClient = {
    subscriptions: {
      retrieve: vi.fn(),
    },
    checkout: {
      sessions: {
        list: vi.fn(),
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getPrisma as any).mockReturnValue(mockPrisma);
    (getStripe as any).mockReturnValue(mockStripeClient);
  });

  it('should resolve plan from checkout session when subscription metadata is missing', async () => {
    const event = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_123',
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    };

    // 1. Initial findFirst in invoice.paid returns null (missing membership)
    // 2. Second findFirst in upsertMembershipFromStripeSubscription returns null (new user, no existing membership)
    // 3. Third findFirst (after recovery) returns membership
    let findFirstCalls = 0;
    mockPrisma.membershipSubscription.findFirst.mockImplementation(async (args) => {
        findFirstCalls++;
        // Call 1: invoice.paid check
        if (findFirstCalls === 1) return null;
        // Call 2: upsertMembershipFromStripeSubscription check by customer ID
        if (findFirstCalls === 2) return null; 
        
        // Call 3: verification after upsert
        return {
            id: 'mem_123',
            userId: 'user_123',
            stripeSubId: 'sub_123',
            user: { id: 'user_123', serviceMilesWallet: { balance: 0 } },
            plan: { id: 'plan_PLUS', monthlyServiceMiles: 100, rolloverCapMiles: 50, name: 'OTW PLUS' },
            stripePriceId: 'price_mismatch',
        };
    });

    // Mock User Find (used by findUserIdFromMetadata)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_123' });

    // Mock Subscription Retrieve - NO METADATA, mismatched price
    mockStripeClient.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      items: { data: [{ price: { id: 'price_mismatch' } }] },
      metadata: {}, // EMPTY METADATA
    });

    // Mock Checkout Session List - HAS METADATA
    mockStripeClient.checkout.sessions.list.mockResolvedValue({
      data: [{
        metadata: { userId: 'user_123', planCode: 'plus' }
      }]
    });

    // Mock Plan Find - First call (by price) fails, Second call (by name from session) succeeds
    mockPrisma.membershipPlan.findFirst.mockImplementation(async (args) => {
        if (args.where.stripePriceId === 'price_mismatch') return null;
        if (args.where.name?.equals === 'OTW PLUS') return { id: 'plan_PLUS', name: 'OTW PLUS', monthlyServiceMiles: 100, rolloverCapMiles: 50 };
        return null;
    });

    // Mock Wallet
    mockPrisma.serviceMilesWallet.findUnique.mockResolvedValue({ id: 'wallet_123', balanceMiles: 0 });
    mockPrisma.serviceMilesWallet.create.mockResolvedValue({ id: 'wallet_123', balanceMiles: 0 });
    mockPrisma.serviceMilesLedger.findFirst.mockResolvedValue(null); // No existing ledger entry

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    const response = await POST(req);

    // @ts-ignore
    expect(response.status).toBe(200);

    // Verify we tried to fetch checkout sessions
    expect(mockStripeClient.checkout.sessions.list).toHaveBeenCalledWith({ subscription: 'sub_123', limit: 1 });

    // Verify upsert was called with the correct planId
    expect(mockPrisma.membershipSubscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({
            planId: 'plan_PLUS'
        }),
        update: expect.objectContaining({
            planId: 'plan_PLUS'
        })
    }));
  });
});
