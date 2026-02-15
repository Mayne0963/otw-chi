import { describe, expect, it } from 'vitest';
import {
  computeBillableBaseTotalCents,
  computeBillableReceiptSubtotalCents,
  computeBillableTotalAfterDiscountCents,
  isCashDelivery,
} from './order-pricing';

describe('order pricing', () => {
  it('charges delivery fee only for food with uploaded receipt', () => {
    const subtotal = computeBillableReceiptSubtotalCents({
      serviceType: 'FOOD',
      deliveryFeeCents: 799,
      receiptImageData: 'data:image/png;base64,abc',
      receiptItems: [{ price: 12.5, quantity: 1 }],
    });

    expect(subtotal).toBe(0);
    expect(
      computeBillableBaseTotalCents({
        serviceType: 'FOOD',
        deliveryFeeCents: 799,
        receiptImageData: 'data:image/png;base64,abc',
        receiptItems: [{ price: 12.5, quantity: 1 }],
      })
    ).toBe(799);
  });

  it('keeps receipt subtotal for cash food deliveries', () => {
    const subtotal = computeBillableReceiptSubtotalCents({
      serviceType: 'FOOD',
      deliveryFeeCents: 799,
      receiptImageData: 'data:image/png;base64,abc',
      receiptItems: [{ price: 12.5, quantity: 2 }],
      cashDelivery: true,
    });

    expect(subtotal).toBe(2500);
  });

  it('detects cash delivery from quote breakdown', () => {
    expect(
      isCashDelivery({
        quoteBreakdown: {
          adders: {
            cashHandling: 12,
          },
        },
      })
    ).toBe(true);
  });

  it('applies discount to the billable amount', () => {
    const total = computeBillableTotalAfterDiscountCents({
      serviceType: 'FOOD',
      deliveryFeeCents: 1000,
      receiptImageData: 'data:image/png;base64,abc',
      receiptItems: [{ price: 20, quantity: 1 }],
      discountCents: 300,
    });

    expect(total).toBe(700);
  });
});
