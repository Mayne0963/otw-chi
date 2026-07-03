export const UNLIMITED_SERVICE_MILES = -1;

function normalizeMiles(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.trunc(value);
}

function isUnlimitedMiles(value: number): boolean {
  return normalizeMiles(value) === UNLIMITED_SERVICE_MILES;
}

export function calculateMonthlyMilesRollover(input: {
  currentBalance: number;
  rolloverCap: number;
  monthlyGrant: number;
}): { rolloverBank: number; expiredMiles: number; newBalance: number } {
  const currentRaw = normalizeMiles(input.currentBalance);
  const capRaw = normalizeMiles(input.rolloverCap);
  const grantRaw = normalizeMiles(input.monthlyGrant);

  if (isUnlimitedMiles(currentRaw) || isUnlimitedMiles(grantRaw)) {
    return { rolloverBank: UNLIMITED_SERVICE_MILES, expiredMiles: 0, newBalance: UNLIMITED_SERVICE_MILES };
  }

  const currentBalance = Math.max(0, currentRaw);
  const rolloverCap = isUnlimitedMiles(capRaw)
    ? Number.POSITIVE_INFINITY
    : Math.max(0, capRaw);
  const monthlyGrant = Math.max(0, grantRaw);

  const rolloverBank = Number.isFinite(rolloverCap)
    ? Math.min(currentBalance, rolloverCap)
    : currentBalance;
  const expiredMiles = Math.max(0, currentBalance - rolloverBank);
  const newBalance = rolloverBank + monthlyGrant;

  return { rolloverBank, expiredMiles, newBalance };
}
