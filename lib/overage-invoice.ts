import { OverageStatus, Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { getPeriodKey, getPreviousPeriodKey } from './overage-period';

type TxClient = Prisma.TransactionClient;
export { getPeriodKey, getPreviousPeriodKey } from './overage-period';

export async function upsertPeriod(tx: TxClient, userId: string, periodKey: string) {
  return tx.overageInvoicePeriod.upsert({
    where: {
      userId_periodKey: {
        userId,
        periodKey,
      },
    },
    update: {},
    create: {
      userId,
      periodKey,
      status: OverageStatus.PENDING,
    },
  });
}

export async function addLineItem(
  tx: TxClient,
  input: {
    periodId: string;
    userId: string;
    requestId: string;
    overageCents: number;
  }
) {
  return tx.overageLineItem.upsert({
    where: {
      deliveryRequestId: input.requestId,
    },
    update: {
      periodId: input.periodId,
      userId: input.userId,
      overageCents: input.overageCents,
    },
    create: {
      periodId: input.periodId,
      userId: input.userId,
      deliveryRequestId: input.requestId,
      overageCents: input.overageCents,
      status: OverageStatus.PENDING,
    },
  });
}

export async function recomputePeriodTotal(tx: TxClient, periodId: string) {
  const aggregate = await tx.overageLineItem.aggregate({
    where: {
      periodId,
      status: { in: [OverageStatus.PENDING, OverageStatus.INVOICED] },
    },
    _sum: { overageCents: true },
  });

  const totalCents = aggregate._sum.overageCents ?? 0;

  const period = await tx.overageInvoicePeriod.update({
    where: { id: periodId },
    data: { totalCents },
  });

  return {
    period,
    totalCents,
  };
}

export interface ClosePeriodResult {
  userId: string;
  periodKey: string;
  periodId?: string;
  invoiceId?: string;
  invoiced: boolean;
  skipped: boolean;
  reason?: string;
  lineItemCount: number;
  totalCents: number;
}

export async function closePeriodForUser(userId: string, periodKey: string): Promise<ClosePeriodResult> {
  const prisma = getPrisma();
  const stripe = getStripe();

  const membership = await prisma.membershipSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!membership || !membership.plan) {
    return {
      userId,
      periodKey,
      invoiced: false,
      skipped: true,
      reason: 'No active membership plan found',
      lineItemCount: 0,
      totalCents: 0,
    };
  }

  if (membership.plan.overageBillingMode !== 'INVOICE') {
    return {
      userId,
      periodKey,
      invoiced: false,
      skipped: true,
      reason: 'Plan is not configured for invoice overage billing',
      lineItemCount: 0,
      totalCents: 0,
    };
  }

  if (!membership.stripeCustomerId) {
    return {
      userId,
      periodKey,
      invoiced: false,
      skipped: true,
      reason: 'Missing stripe customer id',
      lineItemCount: 0,
      totalCents: 0,
    };
  }

  const period = await prisma.overageInvoicePeriod.findUnique({
    where: {
      userId_periodKey: {
        userId,
        periodKey,
      },
    },
  });

  if (!period) {
    return {
      userId,
      periodKey,
      invoiced: false,
      skipped: true,
      reason: 'No overage period found',
      lineItemCount: 0,
      totalCents: 0,
    };
  }

  if (period.stripeInvoiceId) {
    return {
      userId,
      periodKey,
      periodId: period.id,
      invoiceId: period.stripeInvoiceId,
      invoiced: false,
      skipped: true,
      reason: 'Period already invoiced',
      lineItemCount: 0,
      totalCents: period.totalCents,
    };
  }

  const pendingLineItems = await prisma.overageLineItem.findMany({
    where: {
      periodId: period.id,
      status: OverageStatus.PENDING,
    },
    select: {
      id: true,
      overageCents: true,
      deliveryRequestId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (pendingLineItems.length === 0) {
    return {
      userId,
      periodKey,
      periodId: period.id,
      invoiced: false,
      skipped: true,
      reason: 'No pending overage line items',
      lineItemCount: 0,
      totalCents: period.totalCents,
    };
  }

  const totalCents = pendingLineItems.reduce((sum, item) => sum + item.overageCents, 0);
  if (totalCents <= 0) {
    return {
      userId,
      periodKey,
      periodId: period.id,
      invoiced: false,
      skipped: true,
      reason: 'Zero total for pending line items',
      lineItemCount: pendingLineItems.length,
      totalCents,
    };
  }

  for (const item of pendingLineItems) {
    await stripe.invoiceItems.create(
      {
        customer: membership.stripeCustomerId,
        amount: item.overageCents,
        currency: 'usd',
        description: `OTW Overage for request ${item.deliveryRequestId}`,
        metadata: {
          purpose: 'overage_invoice_item',
          userId,
          periodKey,
          periodId: period.id,
          lineItemId: item.id,
          deliveryRequestId: item.deliveryRequestId,
        },
      },
      {
        idempotencyKey: `overage_line_item:${item.id}`,
      }
    );
  }

  const invoice = await stripe.invoices.create(
    {
      customer: membership.stripeCustomerId,
      collection_method: 'charge_automatically',
      auto_advance: true,
      metadata: {
        purpose: 'overage_invoice',
        userId,
        periodKey,
        periodId: period.id,
      },
    },
    {
      idempotencyKey: `overage_invoice:${period.id}`,
    }
  );

  await prisma.$transaction(async (tx) => {
    await tx.overageInvoicePeriod.update({
      where: { id: period.id },
      data: {
        stripeInvoiceId: invoice.id,
        status: OverageStatus.INVOICED,
        totalCents,
      },
    });

    await tx.overageLineItem.updateMany({
      where: {
        periodId: period.id,
        status: OverageStatus.PENDING,
      },
      data: {
        status: OverageStatus.INVOICED,
      },
    });

    await tx.deliveryRequest.updateMany({
      where: {
        id: { in: pendingLineItems.map((item) => item.deliveryRequestId) },
      },
      data: {
        overageStatus: OverageStatus.INVOICED,
        overageInvoiceId: invoice.id,
      },
    });
  });

  return {
    userId,
    periodKey,
    periodId: period.id,
    invoiceId: invoice.id,
    invoiced: true,
    skipped: false,
    lineItemCount: pendingLineItems.length,
    totalCents,
  };
}
