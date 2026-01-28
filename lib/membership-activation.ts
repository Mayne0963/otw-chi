import { Prisma, ServiceMilesTransactionType, MembershipStatus } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { calculateMonthlyMilesRollover, UNLIMITED_SERVICE_MILES } from './membership-miles';

interface ActivationParams {
  userId: string;
  subscriptionId: string;
  stripeCustomerId: string;
  status: MembershipStatus;
  currentPeriodEnd: Date | undefined;
  priceId?: string;
  planRecord: {
    id: string;
    name: string;
    monthlyServiceMiles: number;
    rolloverCapMiles: number;
  };
  invoiceId: string;
}

export async function activateMembershipAtomically(params: ActivationParams) {
  const { 
    userId, subscriptionId, stripeCustomerId, status, 
    currentPeriodEnd, priceId, planRecord, invoiceId 
  } = params;
  
  const prisma = getPrisma();

  return await prisma.$transaction(async (tx) => {
    // A. Upsert Membership
    // This ensures the user is ACTIVE immediately when the invoice is paid
    const membership = await tx.membershipSubscription.upsert({
      where: { userId },
      update: {
        status,
        currentPeriodEnd,
        stripeCustomerId,
        stripeSubId: subscriptionId,
        ...(priceId ? { stripePriceId: priceId } : {}),
        planId: planRecord.id,
      },
      create: {
        userId,
        status,
        currentPeriodEnd,
        stripeCustomerId,
        stripeSubId: subscriptionId,
        ...(priceId ? { stripePriceId: priceId } : {}),
        planId: planRecord.id,
      },
    });

    // B. Handle Service Miles Allocation
    // Refresh wallet in transaction to lock
    let wallet = await tx.serviceMilesWallet.findUnique({ where: { userId } });
    
    if (!wallet) {
        wallet = await tx.serviceMilesWallet.create({ data: { userId } });
    }

    const idempotencyKeyBase = `stripe_invoice:${invoiceId}`;
    const rollInKey = `${idempotencyKeyBase}:ROLL_IN`;
    
    // Idempotency Check: Have we already processed this invoice?
    const alreadyProcessed = await tx.serviceMilesLedger.findFirst({
      where: { walletId: wallet.id, idempotencyKey: rollInKey } as any,
      select: { id: true },
    });
    
    if (alreadyProcessed) {
        return { status: 'ALREADY_PROCESSED', membership };
    }

    const currentBalance = wallet.balanceMiles;
    const rolloverCap = planRecord.rolloverCapMiles;
    const monthlyGrant = planRecord.monthlyServiceMiles;

    const { rolloverBank, expiredMiles, newBalance } = calculateMonthlyMilesRollover({
      currentBalance,
      rolloverCap,
      monthlyGrant,
    });

    // C. Create Ledger Entries
    try {
      // 1. Roll In (Marker for idempotency & history)
      await tx.serviceMilesLedger.create({
        data: {
          walletId: wallet.id,
          amount: 0,
          transactionType: ServiceMilesTransactionType.ROLL_IN,
          idempotencyKey: rollInKey,
          description: `${rollInKey} rolled=${rolloverBank}`,
        } as any,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
         // Race condition caught
         return { status: 'RACE_CONDITION_DETECTED' };
      }
      throw error;
    }
    
    const isUnlimited = newBalance === UNLIMITED_SERVICE_MILES;

    // 2. Expire old miles (if any)
    if (!isUnlimited && expiredMiles > 0) {
        await tx.serviceMilesLedger.create({
            data: {
                walletId: wallet.id,
                amount: -expiredMiles,
                transactionType: ServiceMilesTransactionType.EXPIRE,
                idempotencyKey: `${idempotencyKeyBase}:EXPIRE`,
                description: `${idempotencyKeyBase}:EXPIRE cap=${rolloverCap}`,
            } as any
        });
    }

    // 3. Add Monthly Grant
    if (!isUnlimited && monthlyGrant > 0) {
        await tx.serviceMilesLedger.create({
            data: {
                walletId: wallet.id,
                amount: monthlyGrant,
                transactionType: ServiceMilesTransactionType.ADD_MONTHLY,
                idempotencyKey: `${idempotencyKeyBase}:ADD_MONTHLY`,
                description: `${idempotencyKeyBase}:ADD_MONTHLY plan=${planRecord.name}`,
            } as any
        });
    }

    // D. Update Wallet Balance
    await tx.serviceMilesWallet.update({
        where: { id: wallet.id },
        data: {
            balanceMiles: newBalance,
            rolloverBankMiles: rolloverBank === UNLIMITED_SERVICE_MILES ? 0 : rolloverBank
        }
    });

    return { status: 'SUCCESS', membership, milesAdded: monthlyGrant };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
