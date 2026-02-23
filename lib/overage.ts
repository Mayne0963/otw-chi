export interface ComputeOverageInput {
  requiredMiles: number;
  availableMiles: number;
  rateCentsPerMile: number;
  minCents: number;
}

export interface ComputeOverageResult {
  milesUsed: number;
  overageMiles: number;
  overageCents: number;
}

function clampInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function computeOverage(input: ComputeOverageInput): ComputeOverageResult {
  const requiredMiles = clampInt(input.requiredMiles);
  const availableMiles = clampInt(input.availableMiles);
  const rateCentsPerMile = clampInt(input.rateCentsPerMile);
  const minCents = clampInt(input.minCents);

  const milesUsed = Math.min(requiredMiles, availableMiles);
  const overageMiles = Math.max(0, requiredMiles - milesUsed);

  let overageCents = overageMiles * rateCentsPerMile;
  if (overageMiles > 0 && overageCents > 0 && overageCents < minCents) {
    overageCents = minCents;
  }

  return {
    milesUsed,
    overageMiles,
    overageCents,
  };
}
