'use server';

import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import {
  getActiveSubscription,
  getMembershipBenefits,
  getPlanCodeFromSubscription,
} from '@/lib/membership';
import { resolveDeliveryPaymentPreferenceByPlan } from '@/lib/membership-perks';
import { calculatePriceBreakdownCents } from '@/lib/pricing';
import { cancelDeliveryRequest, submitDeliveryRequest } from '@/lib/delivery-submit';
import { purgeExpiredPickupPassForRequest } from '@/lib/pickup-pass';
import { closeRequestChat } from '@/lib/request-chat';
import { syncOtwTrueEmployeeAccessForUser, isOtwTrueBenefitType } from '@/lib/otw-true';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sendZapierWebhook } from '@/lib/services/zapier';

import {
  DeliveryRequestStatus,
  OverageBillingMode,
  ServiceMilesTransactionType,
  ServiceType,
} from '@prisma/client';

export async function cancelOrderAction(orderId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const prisma = getPrisma();

  // Try to find as DeliveryRequest first
  const deliveryRequest = await prisma.deliveryRequest.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      status: true,
    },
  });

  if (deliveryRequest) {
    if (deliveryRequest.userId !== user.id) {
      throw new Error('Unauthorized');
    }
    const cancellableStatuses: DeliveryRequestStatus[] = [
      DeliveryRequestStatus.REQUESTED,
      DeliveryRequestStatus.ASSIGNED,
      DeliveryRequestStatus.PICKED_UP,
      DeliveryRequestStatus.EN_ROUTE,
    ];
    if (!cancellableStatuses.includes(deliveryRequest.status)) {
      throw new Error('Order cannot be canceled in current status');
    }

    await cancelDeliveryRequest(orderId, user.id);
    await closeRequestChat(prisma, {
      deliveryRequestId: orderId,
      senderUserId: user.id,
      senderRole: user.role,
    });
    revalidatePath(`/order/${orderId}`);
    revalidatePath(`/requests/${orderId}`);
    revalidatePath('/requests');
    revalidatePath(`/track/${orderId}`);
    revalidatePath('/dashboard');
    return { success: true };
  }

  throw new Error('Order not found');
}



export type UserRequestListItem = {
  id: string;
  kind: 'ORDER';
  serviceType: ServiceType;
  pickup: string;
  dropoff: string;
  status: DeliveryRequestStatus | 'CANCELLED';
  costCents: number | null;
  serviceMilesPaid: number | null;
  paidWithServiceMilesOnly: boolean;
  createdAt: Date;
  href: string;
};

const toRadians = (deg: number) => (deg * Math.PI) / 180;

const haversineMiles = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 3959;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const computeMilesFromHere = async (
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
) => {
  const apiKey = process.env.HERE_API_KEY;
  if (!apiKey) {
    return haversineMiles(pickupLat, pickupLng, dropoffLat, dropoffLng);
  }

  const url = new URL('https://router.hereapi.com/v8/routes');
  url.searchParams.set('transportMode', 'car');
  url.searchParams.set('origin', `${pickupLat},${pickupLng}`);
  url.searchParams.set('destination', `${dropoffLat},${dropoffLng}`);
  url.searchParams.set('return', 'summary');
  url.searchParams.set('routingMode', 'fast');
  url.searchParams.set('apiKey', apiKey);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      return haversineMiles(pickupLat, pickupLng, dropoffLat, dropoffLng);
    }
    const data = (await res.json()) as {
      routes?: Array<{ sections?: Array<{ summary?: { length?: number } }> }>;
    };
    const lengthMeters = data.routes?.[0]?.sections?.[0]?.summary?.length;
    if (typeof lengthMeters !== 'number' || !Number.isFinite(lengthMeters)) {
      return haversineMiles(pickupLat, pickupLng, dropoffLat, dropoffLng);
    }
    return Math.max(0.1, lengthMeters / 1609.34);
  } catch {
    return haversineMiles(pickupLat, pickupLng, dropoffLat, dropoffLng);
  }
};


export async function createRequestAction(formData: FormData) {
  const pickup = String(formData.get('pickup') ?? '');
  const dropoff = String(formData.get('dropoff') ?? '');
  const st = String(formData.get('serviceType') ?? 'FOOD').toUpperCase();
  const notes = String(formData.get('notes') ?? '');
  const paymentPreferenceInput = String(formData.get('paymentPreference') ?? '')
    .trim()
    .toUpperCase();
  const parseNumber = (value: FormDataEntryValue | null) => {
    if (typeof value !== 'string') return Number.NaN;
    const trimmed = value.trim();
    if (!trimmed) return Number.NaN;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const milesInput = parseNumber(formData.get('miles'));
  const pickupLat = parseNumber(formData.get('pickupLat'));
  const pickupLng = parseNumber(formData.get('pickupLng'));
  const dropoffLat = parseNumber(formData.get('dropoffLat'));
  const dropoffLng = parseNumber(formData.get('dropoffLng'));
  
  // Validate service type
  const serviceType = (['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE', 'RIDE'].includes(st) ? st : 'FOOD') as ServiceType;
  const requestedOtwTrueBenefit = String(formData.get('otwTrueBenefitType') ?? '').trim().toUpperCase();
  const otwTrueBenefitType = isOtwTrueBenefitType(requestedOtwTrueBenefit)
    ? requestedOtwTrueBenefit
    : undefined;

  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const prisma = getPrisma();

  let miles =
    Number.isFinite(milesInput) && milesInput > 0
      ? milesInput
      : Number.isFinite(pickupLat) &&
        Number.isFinite(pickupLng) &&
        Number.isFinite(dropoffLat) &&
        Number.isFinite(dropoffLng)
        ? await computeMilesFromHere(pickupLat, pickupLng, dropoffLat, dropoffLng)
        : null;

  if (!miles || !Number.isFinite(miles) || miles <= 0) {
    throw new Error('Miles estimate is required to create a request.');
  }

  const milesEstimate = Math.max(1, Math.round(miles));
  const travelMinutesFromMiles = Math.max(5, Math.round(Math.max(0.1, miles) * 5));

  await syncOtwTrueEmployeeAccessForUser(prisma, {
    userId: user.id,
    email: user.email,
  });

  // Get membership benefits
  const sub = await getActiveSubscription(user.id);
  const planCode = getPlanCodeFromSubscription(sub);
  const membershipBenefits = getMembershipBenefits(planCode);
  const billingMode = sub?.plan?.overageBillingMode ?? OverageBillingMode.INSTANT;
  const paymentPreference = resolveDeliveryPaymentPreferenceByPlan(
    sub?.plan,
    paymentPreferenceInput === 'MONTHLY' ? 'MONTHLY' : paymentPreferenceInput === 'INSTANT' ? 'INSTANT' : undefined,
  );
  const overageBillingModeOverride =
    paymentPreference === 'MONTHLY' ? OverageBillingMode.INVOICE : OverageBillingMode.INSTANT;

  // Calculate cost with membership discount
  const pricing = calculatePriceBreakdownCents({
    miles,
    serviceType: serviceType as 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE' | 'RIDE',
    discount: membershipBenefits.discount,
    waiveServiceFee: membershipBenefits.waiveServiceFee,
  });
  const finalPriceDollars = pricing.discountedBaseCents / 100;
  const paymentRequired = paymentPreference !== 'MONTHLY' && pricing.totalCents > 0;
  const hasBillableDeliveryFee = pricing.totalCents > 0;
  const deliveryFeePaid = hasBillableDeliveryFee ? false : true;

  // Award NIP based on membership multiplier
  const nipEarned = Math.round(finalPriceDollars * membershipBenefits.nipMultiplier);

  const hasActivePlan = Boolean(sub?.plan);

  const created = hasActivePlan
    ? await submitDeliveryRequest({
        userId: user.id,
        serviceType,
        pickupAddress: pickup,
        dropoffAddress: dropoff,
        notes: notes || undefined,
        scheduledStart: new Date(Date.now() + 30 * 60 * 1000),
        travelMinutes: travelMinutesFromMiles,
        waitMinutes: 0,
        sitAndWait: false,
        numberOfStops: 1,
        returnOrExchange: false,
        cashHandling: false,
        peakHours: false,
        payWithMiles: true,
        overageBillingModeOverride,
        deliveryFeeCents: pricing.totalCents,
        otwTrueBenefitType,
      }).then((result) => result.request)
    : await prisma.deliveryRequest.create({
        data: {
          userId: user.id,
          pickupAddress: pickup,
          dropoffAddress: dropoff,
          serviceType,
          notes: notes || null,
          status: DeliveryRequestStatus.REQUESTED,
          serviceMilesFinal: milesEstimate,
          deliveryFeeCents: pricing.totalCents, // Store in cents
          deliveryFeePaid,
          paymentRequired,
          overageBillingMode: billingMode,
        },
      });

  let effectivePaymentRequired = hasActivePlan
    ? Boolean(created.paymentRequired)
    : paymentRequired;

  const createdDeliveryFeeCents = Number.isFinite(created.deliveryFeeCents)
    ? Math.max(0, Math.round(Number(created.deliveryFeeCents)))
    : 0;
  const deliveryPaymentRequired =
    paymentPreference !== 'MONTHLY' &&
    createdDeliveryFeeCents > 0 &&
    created.deliveryFeePaid !== true;

  if (deliveryPaymentRequired) {
    effectivePaymentRequired = true;
  }

  if (created.paymentRequired !== effectivePaymentRequired) {
    await prisma.deliveryRequest.update({
      where: { id: created.id },
      data: {
        paymentRequired: effectivePaymentRequired,
      },
    });
  }

  // Award NIP to user
  try {
    await prisma.nipTransaction.create({
      data: {
        userId: user.id,
        amount: nipEarned,
        reason: 'REQUEST_REWARD',
        refId: created.id,
      },
    });
  } catch {
    await prisma.nIPLedger.create({
      data: {
        userId: user.id,
        amount: nipEarned,
        type: 'REQUEST_REWARD',
      },
    });
  }
  
  // Trigger Zapier Webhook for the Money Loop
  sendZapierWebhook("otw_request_created", {
    orderId: created.id,
    customerName: user.name || "",
    customerEmail: user.email || "",
    serviceType: created.serviceType,
    pickupAddress: created.pickupAddress,
    dropoffAddress: created.dropoffAddress,
    totalEstimated: createdDeliveryFeeCents / 100,
    status: effectivePaymentRequired ? "Awaiting Payment" : "New",
  });
  
  revalidatePath('/requests');
  revalidatePath('/dashboard');
  
  redirect(effectivePaymentRequired ? `/pay/${created.id}` : `/request/${created.id}`);
}

export async function getUserRequests() {
  const user = await getCurrentUser();
  if (!user) return [];

  const prisma = getPrisma();

  const orders = await prisma.deliveryRequest.findMany({
    where: { userId: user.id, status: { not: DeliveryRequestStatus.DRAFT } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      serviceType: true,
      pickupAddress: true,
      dropoffAddress: true,
      status: true,
      deliveryFeeCents: true,
      discountCents: true,
      tipCents: true,
      createdAt: true,
    },
  });

  const orderIds = orders.map((order) => order.id);
  const serviceMilesPaidByRequestId = new Map<string, number>();
  const milesSettlementRequestIds = new Set<string>();
  const stripePaidRequestIds = new Set<string>();

  if (orderIds.length > 0) {
    const deductedMiles = await prisma.serviceMilesLedger.groupBy({
      by: ['deliveryRequestId'],
      where: {
        deliveryRequestId: { in: orderIds },
        transactionType: ServiceMilesTransactionType.DEDUCT_REQUEST,
        amount: { lt: 0 },
      },
      _sum: {
        amount: true,
      },
    });

    for (const row of deductedMiles) {
      if (!row.deliveryRequestId) continue;
      const summed = typeof row._sum.amount === 'number' ? row._sum.amount : 0;
      if (summed < 0) {
        serviceMilesPaidByRequestId.set(row.deliveryRequestId, Math.abs(Math.trunc(summed)));
      }
    }

    const milesSettlements = await prisma.serviceMilesLedger.findMany({
      where: {
        deliveryRequestId: { in: orderIds },
        externalRef: {
          contains: 'MILES_SETTLE',
        },
      },
      select: {
        deliveryRequestId: true,
      },
    });

    for (const settlement of milesSettlements) {
      if (!settlement.deliveryRequestId) continue;
      milesSettlementRequestIds.add(settlement.deliveryRequestId);
    }

    const stripePayments = await prisma.paymentTransaction.findMany({
      where: {
        orderId: { in: orderIds },
        provider: 'STRIPE',
        status: 'SUCCEEDED',
      },
      select: {
        orderId: true,
      },
    });

    for (const payment of stripePayments) {
      if (!payment.orderId) continue;
      stripePaidRequestIds.add(payment.orderId);
    }
  }

  const computeOrderTotalCents = (order: (typeof orders)[number]) => {
    const deliveryFee = typeof order.deliveryFeeCents === 'number' ? order.deliveryFeeCents : 0;
    const discount = typeof order.discountCents === 'number' ? order.discountCents : 0;
    const tip = typeof order.tipCents === 'number' ? order.tipCents : 0;
    const total = Math.max(0, deliveryFee - discount + tip);
    return total > 0 ? total : null;
  };

  const mapped = orders.map((order) => ({
    id: order.id,
    kind: 'ORDER' as const,
    serviceType: order.serviceType,
    pickup: order.pickupAddress,
    dropoff: order.dropoffAddress,
    status: order.status === DeliveryRequestStatus.CANCELED ? 'CANCELLED' : order.status,
    costCents: computeOrderTotalCents(order),
    serviceMilesPaid: serviceMilesPaidByRequestId.get(order.id) ?? null,
    paidWithServiceMilesOnly:
      milesSettlementRequestIds.has(order.id) && !stripePaidRequestIds.has(order.id),
    createdAt: order.createdAt,
    href: `/requests/${order.id}`,
  })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return mapped;
}

export async function getRequest(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const prisma = getPrisma();
  const request = await prisma.deliveryRequest.findUnique({
    where: { id },
    omit: {
      pickupPassBase64: true,
    },
    include: {
      assignedDriver: {
        include: { user: true }
      },
      user: true,
      orderConfirmation: {
        select: {
          id: true,
          customerConfirmed: true,
          confirmedAt: true,
          disputeStatus: true,
          disputedItems: true,
        },
      },
    }
  });

  if (!request) return null;

  const role = user.role;
  const isCustomer = request.userId === user.id;
  const isAssignedDriver = request.assignedDriver?.userId === user.id;
  const isAdmin = role === 'ADMIN';

  if (!isCustomer && !isAssignedDriver && !isAdmin) {
    return null;
  }

  const purgedCount = await purgeExpiredPickupPassForRequest(prisma, request.id);
  if (purgedCount > 0) {
    request.pickupPassMimeType = null;
    request.pickupPassUploadedAt = null;
    request.pickupPassExpiresAt = null;
  }

  const deductedMiles = await prisma.serviceMilesLedger.aggregate({
    where: {
      deliveryRequestId: request.id,
      transactionType: ServiceMilesTransactionType.DEDUCT_REQUEST,
      amount: { lt: 0 },
    },
    _sum: {
      amount: true,
    },
  });

  const serviceMilesPaid =
    typeof deductedMiles._sum.amount === 'number' && deductedMiles._sum.amount < 0
      ? Math.abs(Math.trunc(deductedMiles._sum.amount))
      : null;

  const [milesSettlement, stripePayment] = await Promise.all([
    prisma.serviceMilesLedger.findFirst({
      where: {
        deliveryRequestId: request.id,
        externalRef: {
          contains: 'MILES_SETTLE',
        },
      },
      select: {
        id: true,
      },
    }),
    prisma.paymentTransaction.findFirst({
      where: {
        orderId: request.id,
        provider: 'STRIPE',
        status: 'SUCCEEDED',
      },
      select: {
        id: true,
      },
    }),
  ]);

  return {
    ...request,
    serviceMilesPaid,
    paidWithServiceMilesOnly: Boolean(milesSettlement) && !stripePayment,
  };
}
