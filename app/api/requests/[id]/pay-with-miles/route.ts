import { NextResponse } from 'next/server';
import { OverageBillingMode, OverageStatus, ServiceMilesTransactionType } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { UNLIMITED_SERVICE_MILES } from '@/lib/membership-miles';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const prisma = getPrisma();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.deliveryRequest.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          paymentRequired: true,
          overageBillingMode: true,
          overageStatus: true,
          overageMiles: true,
        },
      });

      if (!request) {
        return { error: 'Request not found', status: 404 as const };
      }

      const isOwner = request.userId === user.id;
      const isAdmin = user.role === 'ADMIN';
      if (!isOwner && !isAdmin) {
        return { error: 'Forbidden', status: 403 as const };
      }

      if (!request.paymentRequired) {
        return { alreadyPaid: true as const };
      }

      if (
        request.overageBillingMode !== OverageBillingMode.INSTANT ||
        request.overageStatus === OverageStatus.PAID ||
        request.overageMiles <= 0
      ) {
        return {
          error: 'Service Miles payment is only available for instant overage balances',
          status: 409 as const,
        };
      }

      const dbUser = await tx.user.findUnique({
        where: { id: request.userId },
        select: {
          id: true,
          membership: {
            include: {
              plan: {
                select: {
                  monthlyServiceMiles: true,
                },
              },
            },
          },
          serviceMilesWallet: {
            select: {
              id: true,
              balanceMiles: true,
            },
          },
        },
      });

      if (!dbUser) {
        return { error: 'User not found', status: 404 as const };
      }

      const wallet = dbUser.serviceMilesWallet ?? (await tx.serviceMilesWallet.create({
        data: { userId: dbUser.id },
        select: { id: true, balanceMiles: true },
      }));

      const unlimitedByWallet = wallet.balanceMiles === UNLIMITED_SERVICE_MILES;
      const unlimitedByPlan = dbUser.membership?.plan?.monthlyServiceMiles === UNLIMITED_SERVICE_MILES;
      const hasUnlimited = unlimitedByWallet || unlimitedByPlan;
      const requiredMiles = Math.max(0, request.overageMiles);

      if (!hasUnlimited && wallet.balanceMiles < requiredMiles) {
        return {
          error: 'Not enough Service Miles to settle this request',
          status: 409 as const,
          requiredMiles,
          availableMiles: wallet.balanceMiles,
        };
      }

      if (!hasUnlimited && requiredMiles > 0) {
        const deduction = await tx.serviceMilesWallet.updateMany({
          where: {
            id: wallet.id,
            balanceMiles: {
              gte: requiredMiles,
            },
          },
          data: {
            balanceMiles: {
              decrement: requiredMiles,
            },
          },
        });

        if (deduction.count !== 1) {
          return {
            error: 'Service Miles balance changed. Please try again.',
            status: 409 as const,
          };
        }
      }

      const idempotencyKey = `request:${request.id}:OVERAGE_MILES_SETTLE`;
      const externalRef = `request:${request.id}:OVERAGE_MILES_SETTLE`;

      await tx.serviceMilesLedger.upsert({
        where: {
          externalRef,
        },
        update: {},
        create: {
          walletId: wallet.id,
          amount: hasUnlimited ? 0 : -requiredMiles,
          transactionType: ServiceMilesTransactionType.DEDUCT_REQUEST,
          deliveryRequestId: request.id,
          idempotencyKey,
          externalRef,
          description: hasUnlimited
            ? `Overage settled for request ${request.id} on unlimited Service Miles plan`
            : `Overage settled using ${requiredMiles} Service Miles`,
        },
      });

      await tx.deliveryRequest.update({
        where: { id: request.id },
        data: {
          paymentRequired: false,
          overageStatus: OverageStatus.PAID,
        },
      });

      const refreshedWallet = await tx.serviceMilesWallet.findUnique({
        where: { id: wallet.id },
        select: { balanceMiles: true },
      });

      return {
        success: true as const,
        settledWithMiles: requiredMiles,
        remainingMiles: refreshedWallet?.balanceMiles ?? wallet.balanceMiles,
      };
    });

    if ('status' in result) {
      return NextResponse.json(
        {
          error: result.error,
          ...(typeof result.requiredMiles === 'number' ? { requiredMiles: result.requiredMiles } : {}),
          ...(typeof result.availableMiles === 'number' ? { availableMiles: result.availableMiles } : {}),
        },
        { status: result.status },
      );
    }

    if ('alreadyPaid' in result) {
      return NextResponse.json({ alreadyPaid: true });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[REQUEST_PAY_WITH_MILES_ERROR]', {
      requestId: id,
      userId: user.id,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ error: 'Failed to settle request with Service Miles' }, { status: 500 });
  }
}
