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

describe('Stripe Webhook - Checkout Session Completed', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    membershipPlan: {
      findFirst: vi.fn(),
    },
    membershipSubscription: {
      upsert: vi.fn(),
    },
    deliveryRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    serviceMilesLedger: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    serviceMilesWallet: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'wallet_123', balanceMiles: 0 }),
      update: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockPrisma)),
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

  it('should create membership record in Neon when checkout session completes', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          subscription: 'sub_123',
          customer: 'cus_123',
          payment_status: 'paid',
          invoice: 'in_123',
          metadata: {
            userId: 'user_123',
            planCode: 'plus',
            planName: 'OTW PLUS'
          }
        },
      },
    };

    // Mock User Find (for metadata resolution)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_123' });

    // Mock Subscription Retrieve
    mockStripeClient.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      current_period_end: 1735689600, // Jan 1 2025
      items: { data: [{ price: { id: 'price_plus' } }] }
    });

    // Mock Plan Find
    mockPrisma.membershipPlan.findFirst.mockImplementation(async (args) => {
        if (args.where.name?.equals === 'OTW PLUS') return { id: 'plan_PLUS', name: 'OTW PLUS' };
        return null;
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    const response = await POST(req);

    // @ts-ignore
    expect(response.status).toBe(200);

    // Verify Neon (Prisma) Write
    expect(mockPrisma.membershipSubscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'user_123' },
        create: expect.objectContaining({
            userId: 'user_123',
            status: 'ACTIVE',
            planId: 'plan_PLUS',
            stripeSubId: 'sub_123',
            stripePriceId: 'price_plus'
        }),
        update: expect.objectContaining({
            status: 'ACTIVE',
            planId: 'plan_PLUS'
        })
    }));
  });
});
