
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePromoCode, calculateDiscount, redeemPromoCode } from './promo-code';

describe('Promo Code Logic', () => {
  const mockPrisma = {
    promoCode: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    promoRedemption: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (callback) => await callback(mockPrisma)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validatePromoCode', () => {
    it('should validate a valid active promo code', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        id: 'promo_123',
        code: 'SAVE10',
        active: true,
        startsAt: null,
        endsAt: null,
        maxRedemptions: null,
        redemptions: 0,
        percentOff: 10,
        amountOffCents: null,
      });
      mockPrisma.promoRedemption.findUnique.mockResolvedValue(null);

      const result = await validatePromoCode('SAVE10', 'user_1', mockPrisma as any);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.promoCode.code).toBe('SAVE10');
      }
    });

    it('should fail if code does not exist', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(null);
      const result = await validatePromoCode('INVALID', 'user_1', mockPrisma as any);
      expect(result.valid).toBe(false);
      // @ts-ignore
      expect(result.error).toBe('Invalid promo code');
    });

    it('should fail if code is inactive', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        id: 'promo_123',
        code: 'SAVE10',
        active: false,
      });
      const result = await validatePromoCode('SAVE10', 'user_1', mockPrisma as any);
      expect(result.valid).toBe(false);
      // @ts-ignore
      expect(result.error).toBe('Promo code is inactive');
    });

    it('should fail if max redemptions reached', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        id: 'promo_123',
        code: 'SAVE10',
        active: true,
        maxRedemptions: 100,
        redemptions: 100,
      });
      const result = await validatePromoCode('SAVE10', 'user_1', mockPrisma as any);
      expect(result.valid).toBe(false);
      // @ts-ignore
      expect(result.error).toBe('Promo code usage limit reached');
    });

    it('should fail if user already redeemed', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        id: 'promo_123',
        code: 'SAVE10',
        active: true,
      });
      mockPrisma.promoRedemption.findUnique.mockResolvedValue({ id: 'redemption_1' });

      const result = await validatePromoCode('SAVE10', 'user_1', mockPrisma as any);
      expect(result.valid).toBe(false);
      // @ts-ignore
      expect(result.error).toBe('You have already used this promo code');
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate percentage discount', () => {
      const discount = calculateDiscount(1000, { percentOff: 20, amountOffCents: null });
      expect(discount).toBe(200);
    });

    it('should calculate fixed amount discount', () => {
      const discount = calculateDiscount(1000, { percentOff: null, amountOffCents: 300 });
      expect(discount).toBe(300);
    });

    it('should cap discount at subtotal', () => {
      const discount = calculateDiscount(1000, { percentOff: null, amountOffCents: 1500 });
      expect(discount).toBe(1000);
    });
  });

  describe('redeemPromoCode', () => {
    it('should create redemption and increment count', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        id: 'promo_123',
        active: true,
        redemptions: 5,
        maxRedemptions: 10,
      });
      mockPrisma.promoRedemption.findUnique.mockResolvedValue(null);
      mockPrisma.promoRedemption.create.mockResolvedValue({ id: 'r_1' });

      await redeemPromoCode('promo_123', 'user_1', 'order_1', mockPrisma as any);

      expect(mockPrisma.promoRedemption.create).toHaveBeenCalledWith({
        data: {
          promoCodeId: 'promo_123',
          userId: 'user_1',
          orderId: 'order_1',
        },
      });
      expect(mockPrisma.promoCode.update).toHaveBeenCalledWith({
        where: { id: 'promo_123' },
        data: { redemptions: { increment: 1 } },
      });
    });

    it('should throw if already redeemed', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue({
        id: 'promo_123',
        active: true,
      });
      mockPrisma.promoRedemption.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(redeemPromoCode('promo_123', 'user_1', 'order_1', mockPrisma as any))
        .rejects.toThrow('Promo code already redeemed by this user');
    });
  });
});
