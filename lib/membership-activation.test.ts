/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipStatus } from '@prisma/client';

// Mock server-only
vi.mock('server-only', () => { return {}; });

// Mock DB - attempting both alias and relative to be sure
vi.mock('@/lib/db', () => ({
  getPrisma: vi.fn(),
}));
vi.mock('./db', () => ({
  getPrisma: vi.fn(),
}));

// Mock dependencies
vi.mock('./membership-miles', () => ({
  calculateMonthlyMilesRollover: vi.fn().mockReturnValue({
    rolloverBank: 0,
    expiredMiles: 0,
    newBalance: 600,
  }),
  UNLIMITED_SERVICE_MILES: -1,
}));

import { activateMembershipAtomically } from './membership-activation';
import { getPrisma } from '@/lib/db';

describe('Atomic Membership Activation', () => {
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      membershipSubscription: { 
        upsert: vi.fn().mockResolvedValue({ id: 'sub_123', status: 'ACTIVE' }), 
      },
      serviceMilesWallet: { 
        findUnique: vi.fn(), 
        create: vi.fn(),
        update: vi.fn() 
      },
      serviceMilesLedger: { 
        findFirst: vi.fn(),
        findUnique: vi.fn(), 
        create: vi.fn() 
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };

    (getPrisma as any).mockReturnValue(mockPrisma);
  });

  it('should atomically activate membership and grant miles', async () => {
    // Setup Data
    const params = {
      userId: 'user_123',
      subscriptionId: 'sub_123',
      stripeCustomerId: 'cus_123',
      status: MembershipStatus.ACTIVE,
      currentPeriodEnd: new Date('2026-01-01'),
      priceId: 'price_123',
      planRecord: {
        id: 'plan_123',
        name: 'OTW PLUS',
        monthlyServiceMiles: 600,
        rolloverCapMiles: 1200,
      },
      invoiceId: 'in_123',
    };

    // Mock DB State
    mockPrisma.serviceMilesWallet.findUnique.mockResolvedValue({ id: 'wallet_123', balanceMiles: 0 });
    mockPrisma.serviceMilesLedger.findFirst.mockResolvedValue(null); // Not processed yet

    // Execute
    const result = await activateMembershipAtomically(params);

    // Verify Result
    expect(result.status).toBe('SUCCESS');
    expect(result.milesAdded).toBe(600);

    // Verify Transaction Usage
    expect(mockPrisma.$transaction).toHaveBeenCalled();

    // Verify Membership Upsert
    expect(mockPrisma.membershipSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_123' },
        create: expect.objectContaining({
          status: 'ACTIVE',
          planId: 'plan_123',
        }),
      })
    );

    // Verify Miles Allocation
    expect(mockPrisma.serviceMilesLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 600,
          transactionType: 'ADD_MONTHLY',
          idempotencyKey: 'stripe_invoice:in_123:ADD_MONTHLY',
        }),
      })
    );

    // Verify Wallet Update
    expect(mockPrisma.serviceMilesWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wallet_123' },
        data: expect.objectContaining({
          balanceMiles: 600,
        }),
      })
    );
  });

  it('should return ALREADY_PROCESSED if invoice was handled', async () => {
    const params = {
        userId: 'user_123',
        subscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        status: MembershipStatus.ACTIVE,
        currentPeriodEnd: new Date('2026-01-01'),
        planRecord: {
          id: 'plan_123',
          name: 'OTW PLUS',
          monthlyServiceMiles: 600,
          rolloverCapMiles: 1200,
        },
        invoiceId: 'in_123',
    };

    mockPrisma.serviceMilesWallet.findUnique.mockResolvedValue({ id: 'wallet_123', balanceMiles: 600 });
    // Mock Ledger check finding existing record
    mockPrisma.serviceMilesLedger.findUnique.mockResolvedValue({ id: 'ledger_123' });

    const result = await activateMembershipAtomically(params);

    expect(result.status).toBe('ALREADY_PROCESSED');
    // Upsert still happens (idempotent), but miles are skipped
    expect(mockPrisma.membershipSubscription.upsert).toHaveBeenCalled();
    expect(mockPrisma.serviceMilesLedger.create).not.toHaveBeenCalled();
  });
});
