import { Prisma, ServiceMilesTransactionType } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { UNLIMITED_SERVICE_MILES } from '@/lib/membership-miles';

export type WalletReconciliationEntry = {
  walletId: string;
  userId: string;
  userEmail: string;
  cachedBalanceMiles: number;
  ledgerBalanceMiles: number;
  deltaMiles: number;
  isUnlimited: boolean;
  isMismatch: boolean;
  repaired: boolean;
  adjustmentLogged: boolean;
  error?: string;
};

export type ReconcileServiceMilesWalletsInput = {
  userId?: string;
  limit?: number;
  applyFix?: boolean;
  writeAdjustmentEntry?: boolean;
  actorLabel?: string;
};

export type ReconcileServiceMilesWalletsResult = {
  scanned: number;
  mismatches: number;
  repaired: number;
  skippedUnlimited: number;
  applyFix: boolean;
  writeAdjustmentEntry: boolean;
  entries: WalletReconciliationEntry[];
};

function normalizeLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 200;
  const asInt = Math.trunc(parsed);
  if (asInt <= 0) return 200;
  return Math.min(1000, asInt);
}

function buildAdjustmentRef(walletId: string, cachedBalanceMiles: number, ledgerBalanceMiles: number) {
  return `wallet_reconcile:${walletId}:${cachedBalanceMiles}:${ledgerBalanceMiles}`;
}

export async function reconcileServiceMilesWallets(
  input: ReconcileServiceMilesWalletsInput = {}
): Promise<ReconcileServiceMilesWalletsResult> {
  const prisma = getPrisma();
  const limit = normalizeLimit(input.limit);
  const applyFix = input.applyFix === true;
  const writeAdjustmentEntry = input.writeAdjustmentEntry === true;

  const wallets = await prisma.serviceMilesWallet.findMany({
    where: input.userId ? { userId: input.userId } : undefined,
    select: {
      id: true,
      userId: true,
      balanceMiles: true,
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  const walletIds = wallets.map((wallet) => wallet.id);
  const ledgerByWallet = new Map<string, number>();

  if (walletIds.length > 0) {
    const aggregates = await prisma.serviceMilesLedger.groupBy({
      by: ['walletId'],
      where: { walletId: { in: walletIds } },
      _sum: { amount: true },
    });

    for (const row of aggregates) {
      ledgerByWallet.set(row.walletId, row._sum.amount ?? 0);
    }
  }

  let mismatches = 0;
  let repaired = 0;
  let skippedUnlimited = 0;

  const entries: WalletReconciliationEntry[] = [];

  for (const wallet of wallets) {
    const cachedBalanceMiles = wallet.balanceMiles;
    const ledgerBalanceMiles = ledgerByWallet.get(wallet.id) ?? 0;
    const isUnlimited = cachedBalanceMiles === UNLIMITED_SERVICE_MILES;
    const deltaMiles = isUnlimited ? 0 : ledgerBalanceMiles - cachedBalanceMiles;
    const isMismatch = !isUnlimited && deltaMiles !== 0;

    if (isUnlimited) {
      skippedUnlimited += 1;
    }
    if (isMismatch) {
      mismatches += 1;
      console.warn(
        `[WalletReconcile] mismatch wallet=${wallet.id} user=${wallet.userId} cached=${cachedBalanceMiles} ledger=${ledgerBalanceMiles}`
      );
    }

    const entry: WalletReconciliationEntry = {
      walletId: wallet.id,
      userId: wallet.userId,
      userEmail: wallet.user?.email ?? '',
      cachedBalanceMiles,
      ledgerBalanceMiles,
      deltaMiles,
      isUnlimited,
      isMismatch,
      repaired: false,
      adjustmentLogged: false,
    };

    if (isMismatch && applyFix) {
      try {
        await prisma.$transaction(
          async (tx) => {
            await tx.serviceMilesWallet.update({
              where: { id: wallet.id },
              data: { balanceMiles: ledgerBalanceMiles },
            });

            if (writeAdjustmentEntry) {
              const adjustmentRef = buildAdjustmentRef(
                wallet.id,
                cachedBalanceMiles,
                ledgerBalanceMiles
              );

              try {
                await tx.serviceMilesLedger.create({
                  data: {
                    walletId: wallet.id,
                    amount: 0,
                    transactionType: ServiceMilesTransactionType.ADJUST,
                    idempotencyKey: adjustmentRef,
                    externalRef: adjustmentRef,
                    description: `Wallet cache reconciled from ${cachedBalanceMiles} to ${ledgerBalanceMiles}${
                      input.actorLabel ? ` by ${input.actorLabel}` : ''
                    }`,
                  },
                });
                entry.adjustmentLogged = true;
              } catch (error) {
                if (
                  !(error instanceof Prisma.PrismaClientKnownRequestError) ||
                  error.code !== 'P2002'
                ) {
                  throw error;
                }
              }
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        repaired += 1;
        entry.repaired = true;
      } catch (error) {
        entry.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    entries.push(entry);
  }

  return {
    scanned: wallets.length,
    mismatches,
    repaired,
    skippedUnlimited,
    applyFix,
    writeAdjustmentEntry,
    entries,
  };
}
