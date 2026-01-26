export function calculateMonthlyMilesRollover(input: {
  currentBalance: number;
  rolloverCap: number;
  monthlyGrant: number;
}): { rolloverBank: number; expiredMiles: number; newBalance: number } {
  const currentBalance = Math.max(0, Math.trunc(input.currentBalance));
  const rolloverCap = Math.max(0, Math.trunc(input.rolloverCap));
  const monthlyGrant = Math.max(0, Math.trunc(input.monthlyGrant));

  const rolloverBank = Math.min(currentBalance, rolloverCap);
  const expiredMiles = Math.max(0, currentBalance - rolloverBank);
  const newBalance = rolloverBank + monthlyGrant;

  return { rolloverBank, expiredMiles, newBalance };
}
