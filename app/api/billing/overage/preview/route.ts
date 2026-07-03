import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { UNLIMITED_SERVICE_MILES } from '@/lib/membership-miles';
import { computeOverage } from '@/lib/overage';
import { getPeriodKey } from '@/lib/overage-invoice';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      membership: { include: { plan: true } },
      serviceMilesWallet: true,
    },
  });

  if (!dbUser?.membership?.plan) {
    return NextResponse.json({ error: 'Active membership plan required' }, { status: 400 });
  }

  const plan = dbUser.membership.plan;
  const wallet = dbUser.serviceMilesWallet;

  const requiredMilesRaw = Number(new URL(req.url).searchParams.get('requiredMiles') ?? '0');
  const requiredMiles = Number.isFinite(requiredMilesRaw) ? Math.max(0, Math.trunc(requiredMilesRaw)) : 0;

  const balanceMiles = wallet?.balanceMiles ?? 0;
  const unlimited =
    balanceMiles === UNLIMITED_SERVICE_MILES || plan.monthlyServiceMiles === UNLIMITED_SERVICE_MILES;

  const overage = computeOverage({
    requiredMiles,
    availableMiles: unlimited ? requiredMiles : Math.max(0, balanceMiles),
    rateCentsPerMile: plan.overageRateCentsPerMile,
    minCents: plan.overageMinimumCents,
  });

  const periodKey = getPeriodKey(new Date(), 'America/Chicago');
  const period = await prisma.overageInvoicePeriod.findUnique({
    where: {
      userId_periodKey: {
        userId: user.id,
        periodKey,
      },
    },
    select: {
      id: true,
      status: true,
      totalCents: true,
      stripeInvoiceId: true,
    },
  });

  const projectedPeriodTotalCents = (period?.totalCents ?? 0) + overage.overageCents;
  const creditLimit = plan.overageCreditLimitCents;
  const creditRemainingCents =
    creditLimit > 0 ? Math.max(0, creditLimit - (period?.totalCents ?? 0)) : null;

  return NextResponse.json({
    timezone: 'America/Chicago',
    periodKey,
    requiredMiles,
    availableMiles: unlimited ? 'UNLIMITED' : Math.max(0, balanceMiles),
    overageBillingMode: plan.overageBillingMode,
    overageRateCentsPerMile: plan.overageRateCentsPerMile,
    overageMinimumCents: plan.overageMinimumCents,
    overageCreditLimitCents: creditLimit,
    milesUsed: overage.milesUsed,
    overageMiles: overage.overageMiles,
    overageCents: overage.overageCents,
    period: period
      ? {
          id: period.id,
          status: period.status,
          totalCents: period.totalCents,
          stripeInvoiceId: period.stripeInvoiceId,
        }
      : null,
    projectedPeriodTotalCents,
    creditRemainingCents,
  });
}
