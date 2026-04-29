import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/stripe/webhook/route';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { sendZapierWebhook } from '@/lib/services/zapier';

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
    constructor(body: unknown, init: { status?: number } | undefined) {
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

vi.mock('@/lib/services/zapier', () => ({
  sendZapierWebhook: vi.fn().mockResolvedValue(true),
}));

describe('Stripe Webhook - Order Payment Completion', () => {
  const mockPrisma = {
    stripeWebhookEvent: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    deliveryRequest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    paymentTransaction: {
      create: vi.fn(),
    },
    membershipSubscription: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    membershipPlan: {
      findFirst: vi.fn(),
    },
    serviceMilesWallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    serviceMilesLedger: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    overageInvoicePeriod: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    overageLineItem: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => await callback(mockPrisma)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma);
    (getStripe as unknown as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  it('marks order paid via metadata deliveryRequestId even when metadata user differs from request owner', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_order_123',
          amount_total: 4250,
          client_reference_id: null,
          customer_email: 'fallback@example.com',
          customer_details: {
            email: 'jordan@example.com',
          },
          metadata: {
            purpose: 'order_payment',
            userId: 'admin_user_id',
            deliveryRequestId: 'req_123',
            couponCode: 'SAVE10',
            discountCents: '500',
          },
          total_details: {
            amount_discount: 500,
          },
        },
      },
    };

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin_user_id' });
    mockPrisma.deliveryRequest.findUnique.mockResolvedValue({
      id: 'req_123',
      userId: 'customer_user_id',
      overageBillingMode: 'INSTANT',
      overageStatus: 'NONE',
      overageMiles: 0,
      overageCents: 0,
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    const response = await POST(req);

    // @ts-ignore
    expect(response.status).toBe(200);
    expect(mockPrisma.deliveryRequest.update).toHaveBeenCalledWith({
      where: { id: 'req_123' },
      data: expect.objectContaining({
        deliveryFeePaid: true,
        paymentRequired: false,
        couponCode: 'SAVE10',
        discountCents: 500,
      }),
    });
    expect(sendZapierWebhook).toHaveBeenCalledWith('payment_received', {
      schemaVersion: 1,
      requestId: 'cs_order_123',
      submittedAt: expect.any(String),
      businessType: 'otw',
      feature: 'payments',
      action: 'received',
      entityType: 'job_request',
      entityId: 'req_123',
      orderId: 'req_123',
      customerName: '',
      customerEmail: 'jordan@example.com',
      customerPhone: '',
      totalAmount: 42.5,
      status: 'Paid / Booked',
      paymentSource: 'order_payment',
      stripeCheckoutSessionId: 'cs_order_123',
      stripePaymentIntentId: null,
    });
  });
});
