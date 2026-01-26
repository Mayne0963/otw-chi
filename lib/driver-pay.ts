export function calculateDriverPayCents(input: {
  activeMinutes: number;
  hourlyRateCents: number;
  tipsCents: number;
  bonusEligible: boolean;
  bonus5StarCents: number;
}): { hourlyPayCents: number; bonusPayCents: number; totalPayCents: number } {
  const activeMinutes = Math.max(0, input.activeMinutes);
  const hourlyRateCents = Math.max(0, input.hourlyRateCents);
  const tipsCents = Math.max(0, input.tipsCents);
  const bonus5StarCents = Math.max(0, input.bonus5StarCents);

  const hourlyPayCents = Math.round((activeMinutes * hourlyRateCents) / 60);
  const bonusPayCents = input.bonusEligible ? bonus5StarCents : 0;
  const totalPayCents = hourlyPayCents + bonusPayCents + tipsCents;

  return { hourlyPayCents, bonusPayCents, totalPayCents };
}
