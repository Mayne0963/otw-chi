import { describe, expect, it } from 'vitest';
import {
  buildItemsSnapshot,
  shouldMarkNeedsInfoForDispute,
  validateDisputedItemsAgainstSnapshot,
} from './orderConfirmation';

describe('order confirmation disputes', () => {
  it('rejects disputed items that are not in snapshot', () => {
    const snapshot = buildItemsSnapshot([
      { name: 'Burger', quantity: 1, price: 8.5 },
      { name: 'Fries', quantity: 2, price: 3.25 },
    ]);

    const out = validateDisputedItemsAgainstSnapshot(snapshot, [
      {
        itemIdOrName: 'Pizza',
        qtyDisputed: 1,
        reason: 'MISSING',
      },
    ]);

    expect(out.valid).toBe(false);
    expect(out.errors[0]).toContain('does not match any confirmed item');
  });

  it('accepts disputes by item name when item exists in snapshot', () => {
    const snapshot = buildItemsSnapshot([{ name: 'Burger', quantity: 2, price: 8.5 }]);
    const out = validateDisputedItemsAgainstSnapshot(snapshot, [
      {
        itemIdOrName: 'Burger',
        qtyDisputed: 1,
        reason: 'WRONG_ITEM',
      },
    ]);

    expect(out.valid).toBe(true);
    expect(out.normalized[0]?.name).toBe('Burger');
    expect(out.normalized[0]?.qtyDisputed).toBe(1);
  });

  it('marks NEEDS_INFO when evidence is required but missing', () => {
    const needsInfo = shouldMarkNeedsInfoForDispute(
      true,
      [{ itemKey: 'burger-1', name: 'Burger', qtyDisputed: 1, reason: 'MISSING' }],
      []
    );

    expect(needsInfo).toBe(true);
  });
});
