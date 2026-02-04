import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../app/api/stripe/webhook/route';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

// Mock the modules
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

describe('Stripe Webhook - Price Mismatch Recovery', () => {
  const mockPrisma = {
    membershipSubscription: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    membershipPlan: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    serviceMilesWallet: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'wallet_123', balanceMiles: 0 }),
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getPrisma as any).mockReturnValue(mockPrisma);
    (getStripe as any).mockReturnValue(mockStripeClient);
  });

  it('should refresh membership when invoice price does not match DB price', async () => {
    const event = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_123',
          subscription: 'sub_123',
          customer: 'cus_123',
          lines: {
            data: [
              { price: { id: 'price_NEW' } }
            ]
          }
        },
      },
    };

    // 1. First findFirst: Returns membership with OLD price
    // 2. Second findFirst (after recovery): Returns membership with NEW price (simulated)
    let findFirstCalls = 0;
    mockPrisma.membershipSubscription.findFirst.mockImplementation(async (args) => {
        findFirstCalls++;
        // Initial check
        if (findFirstCalls === 1) {
            return {
                id: 'mem_123',
                userId: 'user_123',
                stripeSubId: 'sub_123',
                stripePriceId: 'price_OLD', // Mismatch!
                user: { id: 'user_123', serviceMilesWallet: { balance: 0 } },
                plan: { id: 'plan_OLD', name: 'OTW BASIC' }
            };
        }
        // Check inside upsertMembershipFromStripeSubscription (by customerId)
        if (findFirstCalls === 2) {
             return { userId: 'user_123' };
        }

        // Post-recovery check
        return {
            id: 'mem_123',
            userId: 'user_123',
            stripeSubId: 'sub_123',
            stripePriceId: 'price_NEW', // Updated!
            user: { id: 'user_123', serviceMilesWallet: { balance: 0 } },
            plan: { id: 'plan_NEW', name: 'OTW PLUS', monthlyServiceMiles: 100, rolloverCapMiles: 50 }
        };
    });

    // Mock Subscription Retrieve (triggered by recovery)
    mockStripeClient.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      items: { data: [{ price: { id: 'price_NEW' } }] },
      metadata: { userId: 'user_123', planCode: 'plus' },
    });

    // Mock Plan Find (triggered by upsert)
    mockPrisma.membershipPlan.findFirst.mockResolvedValue({
        id: 'plan_NEW',
        name: 'OTW PLUS'
    });
    
    // Mock User Find
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_123' });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    const response = await POST(req);

    // @ts-ignore
    expect(response.status).toBe(200);

    // Verify Subscription was retrieved
    expect(mockStripeClient.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');

    // Verify Upsert was called with NEW price
    expect(mockPrisma.membershipSubscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ stripePriceId: 'price_NEW' }),
        update: expect.objectContaining({ stripePriceId: 'price_NEW' })
    }));
  });
});
