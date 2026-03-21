import { Prisma, ServiceMilesTransactionType, type PrismaClient } from '@prisma/client';
import { UNLIMITED_SERVICE_MILES } from '@/lib/membership-miles';

type PlanGrantInput = {
  id: string;
  name: string;
  monthlyServiceMiles: number;
};

type GrantParams = {
  userId: string;
  plan: PlanGrantInput;
  currentPeriodEnd?: Date | null;
  source: string;
};

type TxLike = Pick<Prisma.TransactionClient, 'serviceMilesLedger' | 'serviceMilesWallet'>;
type PrismaLike = TxLike & Partial<Pick<PrismaClient, '$transaction'>>;

function buildGrantExternalRef(params: {
  source: string;
  userId: string;
  planId: string;
  periodKey: string;
}) {
  return `${params.source}:${params.userId}:${params.planId}:${params.periodKey}:ADD_MONTHLY`;
}

function resolvePeriodKey(currentPeriodEnd: Date | null | undefined): string {
  if (!currentPeriodEnd || Number.isNaN(currentPeriodEnd.getTime())) {
    return 'no_period';
  }
  return currentPeriodEnd.toISOString().slice(0, 10);
}

export async function grantMembershipMilesForPeriod(
  prisma: PrismaLike,
  params: GrantParams,
): Promise<{ granted: boolean; externalRef: string }> {
  const periodKey = resolvePeriodKey(params.currentPeriodEnd);
  const externalRef = buildGrantExternalRef({
    source: params.source,
    userId: params.userId,
    planId: params.plan.id,
    periodKey,
  });

  const monthlyServiceMiles = Number.isFinite(params.plan.monthlyServiceMiles)
    ? Math.trunc(params.plan.monthlyServiceMiles)
    : 0;

  if (monthlyServiceMiles === 0) {
    return { granted: false, externalRef };
  }

  const execute = async (tx: TxLike) => {
      const existingLedger = await tx.serviceMilesLedger.findUnique({
        where: { externalRef },
        select: { id: true },
      });
      if (existingLedger) {
        return { granted: false, externalRef };
      }

      const wallet = await tx.serviceMilesWallet.upsert({
        where: { userId: params.userId },
        update: {},
        create: { userId: params.userId },
      });

      if (monthlyServiceMiles === UNLIMITED_SERVICE_MILES) {
        await tx.serviceMilesWallet.update({
          where: { id: wallet.id },
          data: {
            balanceMiles: UNLIMITED_SERVICE_MILES,
            rolloverBankMiles: 0,
          },
        });

        await tx.serviceMilesLedger.create({
          data: {
            walletId: wallet.id,
            amount: 0,
            transactionType: ServiceMilesTransactionType.ADD_MONTHLY,
            idempotencyKey: externalRef,
            externalRef,
            description: `${params.source} unlimited grant for ${params.plan.name}`,
          },
        });

        return { granted: true, externalRef };
      }

      if (monthlyServiceMiles > 0) {
        await tx.serviceMilesWallet.update({
          where: { id: wallet.id },
          data: {
            balanceMiles: { increment: monthlyServiceMiles },
          },
        });

        await tx.serviceMilesLedger.create({
          data: {
            walletId: wallet.id,
            amount: monthlyServiceMiles,
            transactionType: ServiceMilesTransactionType.ADD_MONTHLY,
            idempotencyKey: externalRef,
            externalRef,
            description: `${params.source} grant for ${params.plan.name}`,
          },
        });

        return { granted: true, externalRef };
      }

      return { granted: false, externalRef };
    };

  if (typeof prisma.$transaction === 'function') {
    return prisma.$transaction(execute, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  return execute(prisma);
}
