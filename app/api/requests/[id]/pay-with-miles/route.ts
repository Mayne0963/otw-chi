import { NextResponse } from 'next/server';
import { OverageBillingMode, OverageStatus, ServiceMilesTransactionType } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { UNLIMITED_SERVICE_MILES } from '@/lib/membership-miles';
import { shouldRequireDeliveryFeePayment } from '@/lib/delivery-payment';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

function resolveDeliveryFeeMilesRequired(params: {
  serviceMilesFinal: number | null;
  deliveryFeeCents: number | null;
  overageRateCentsPerMile: number | null;
}) {
  const milesFromQuote = Number.isFinite(params.serviceMilesFinal)
    ? Math.max(0, Math.round(Number(params.serviceMilesFinal)))
    : 0;
  if (milesFromQuote > 0) {
    return milesFromQuote;
  }

  const deliveryFeeCents = Number.isFinite(params.deliveryFeeCents)
    ? Math.max(0, Math.round(Number(params.deliveryFeeCents)))
    : 0;
  const rateCentsPerMile = Number.isFinite(params.overageRateCentsPerMile)
    ? Math.max(1, Math.round(Number(params.overageRateCentsPerMile)))
    : 0;

  if (deliveryFeeCents <= 0 || rateCentsPerMile <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(deliveryFeeCents / rateCentsPerMile));
}

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
          deliveryFeeCents: true,
          deliveryFeePaid: true,
          paymentRequired: true,
          serviceMilesFinal: true,
          overageBillingMode: true,
          overageStatus: true,
          overageMiles: true,
          user: {
            select: {
              membership: {
                select: {
                  plan: {
                    select: {
                      overageRateCentsPerMile: true,
                    },
                  },
                },
              },
            },
          },
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

      const requiresDeliveryFeePayment = shouldRequireDeliveryFeePayment({
        deliveryFeeCents: request.deliveryFeeCents,
        deliveryFeePaid: request.deliveryFeePaid,
        billingMode: request.overageBillingMode,
      });

      const requiresOveragePayment =
        request.paymentRequired &&
        request.overageBillingMode === OverageBillingMode.INSTANT &&
        request.overageStatus !== OverageStatus.PAID &&
        request.overageMiles > 0;

      if (!requiresDeliveryFeePayment && !requiresOveragePayment) {
        return { alreadyPaid: true as const };
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
      const deliveryFeeMilesRequired = resolveDeliveryFeeMilesRequired({
        serviceMilesFinal: request.serviceMilesFinal,
        deliveryFeeCents: request.deliveryFeeCents,
        overageRateCentsPerMile:
          request.user.membership?.plan?.overageRateCentsPerMile ?? null,
      });
      const overageMilesRequired = Math.max(0, request.overageMiles);
      const requiredMiles = requiresDeliveryFeePayment
        ? deliveryFeeMilesRequired
        : overageMilesRequired;

      if (requiredMiles <= 0) {
        return {
          error: 'Service Miles payment is unavailable for this request',
          status: 409 as const,
        };
      }

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

      const settlementScope = requiresDeliveryFeePayment ? 'DELIVERY_FEE' : 'OVERAGE';
      const externalRef = `request:${request.id}:${settlementScope}:MILES_SETTLE`;
      const idempotencyKey = externalRef;

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
            ? `${requiresDeliveryFeePayment ? 'Delivery fee' : 'Overage'} settled for request ${request.id} on unlimited Service Miles plan`
            : `${requiresDeliveryFeePayment ? 'Delivery fee' : 'Overage'} settled using ${requiredMiles} Service Miles`,
        },
      });

      const nextPaymentRequired = requiresDeliveryFeePayment
        ? requiresOveragePayment
        : false;

      await tx.deliveryRequest.update({
        where: { id: request.id },
        data: {
          paymentRequired: nextPaymentRequired,
          ...(requiresDeliveryFeePayment
            ? {
                deliveryFeePaid: true,
              }
            : {
                overageStatus: OverageStatus.PAID,
              }),
        },
      });

      const refreshedWallet = await tx.serviceMilesWallet.findUnique({
        where: { id: wallet.id },
        select: { balanceMiles: true },
      });

      return {
        success: true as const,
        settledType: requiresDeliveryFeePayment ? ('DELIVERY_FEE' as const) : ('OVERAGE' as const),
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
