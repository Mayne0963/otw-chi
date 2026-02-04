import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../app/api/stripe/webhook/route';
import { getPrisma } from '@/lib/db';

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

import { getStripe } from '@/lib/stripe';

describe('Stripe Webhook - Invoice Paid Recovery', () => {
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
    $transaction: vi.fn(async (callback) => {
      return await callback(mockPrisma);
    }),
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

  it('should recover and award miles when membership is missing initially', async () => {
    const event = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    };

    // Custom mock implementation to debug calls
    let findFirstCalls = 0;
    mockPrisma.membershipSubscription.findFirst.mockImplementation(async (args) => {
        findFirstCalls++;
        // console.log(`findFirst call #${findFirstCalls} args:`, JSON.stringify(args));
        if (findFirstCalls === 1) return null;
        return {
            id: 'mem_123',
            userId: 'user_123',
            stripeSubId: 'sub_123',
            user: {
                id: 'user_123',
                serviceMilesWallet: { balance: 100 },
            },
            plan: {
                id: 'plan_123',
                monthlyServiceMiles: 60,
                rolloverCapMiles: 30,
            },
        };
    });

    mockStripeClient.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      items: { data: [{ price: { id: 'price_123' } }] },
      metadata: { userId: 'user_123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_123' });
    mockPrisma.membershipPlan.findFirst.mockResolvedValue({ id: 'plan_123', name: 'OTW PLUS' });
    
    mockPrisma.serviceMilesWallet.findUnique.mockResolvedValue(null);
    mockPrisma.serviceMilesWallet.create.mockResolvedValue({ id: 'wallet_123', balanceMiles: 100 });
    mockPrisma.serviceMilesLedger.create.mockResolvedValue({ id: 'ledger_123' });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    const response = await POST(req);

    // Assertions
    // @ts-ignore
    expect(response.status).toBe(200);
    
    // Verify recovery logic was triggered
    expect(mockStripeClient.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
    expect(mockPrisma.membershipSubscription.upsert).toHaveBeenCalled(); // From recovery
    
    // Verify miles transaction was called
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
