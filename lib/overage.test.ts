import { describe, expect, it } from 'vitest';
import { computeOverage } from './overage';

describe('computeOverage', () => {
  it('uses available miles first and bills remainder', () => {
    const result = computeOverage({
      requiredMiles: 40,
      availableMiles: 25,
      rateCentsPerMile: 200,
      minCents: 500,
    });

    expect(result).toEqual({
      milesUsed: 25,
      overageMiles: 15,
      overageCents: 3000,
    });
  });

  it('applies minimum overage charge when overage exists', () => {
    const result = computeOverage({
      requiredMiles: 12,
      availableMiles: 10,
      rateCentsPerMile: 100,
      minCents: 500,
    });

    expect(result).toEqual({
      milesUsed: 10,
      overageMiles: 2,
      overageCents: 500,
    });
  });

  it('produces zero overage when miles fully covered', () => {
    const result = computeOverage({
      requiredMiles: 18,
      availableMiles: 20,
      rateCentsPerMile: 200,
      minCents: 500,
    });

    expect(result).toEqual({
      milesUsed: 18,
      overageMiles: 0,
      overageCents: 0,
    });
  });
});
