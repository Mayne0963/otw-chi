import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { UNLIMITED_SERVICE_MILES } from '@/lib/membership-miles';

export const runtime = 'nodejs';

export async function GET() {
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

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const membership = dbUser.membership;
  const plan = membership?.plan ?? null;

  const wallet = dbUser.serviceMilesWallet;
  const balanceMiles = wallet?.balanceMiles ?? 0;

  const unlimited = balanceMiles === UNLIMITED_SERVICE_MILES || plan?.monthlyServiceMiles === UNLIMITED_SERVICE_MILES;

  return NextResponse.json(
    {
      membership: membership
        ? {
            status: membership.status,
            currentPeriodEnd: membership.currentPeriodEnd,
          }
        : null,
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            monthlyServiceMiles: plan.monthlyServiceMiles,
            rolloverCapMiles: plan.rolloverCapMiles,
            advanceDiscountMax: plan.advanceDiscountMax,
            priorityLevel: plan.priorityLevel,
            markupFree: plan.markupFree,
            cashAllowed: plan.cashAllowed,
            peerToPeerAllowed: plan.peerToPeerAllowed,
            allowedServiceTypes: plan.allowedServiceTypes,
          }
        : null,
      wallet: wallet
        ? {
            id: wallet.id,
            balanceMiles,
            rolloverBankMiles: wallet.rolloverBankMiles,
          }
        : {
            id: null,
            balanceMiles,
            rolloverBankMiles: 0,
          },
      unlimited,
    },
    { status: 200 }
  );
}

