'use server';

import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { calculatePriceBreakdownCents } from '@/lib/pricing';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { DeliveryRequestStatus, ServiceType, RequestStatus } from '@prisma/client';

export type UserRequestListItem = {
  id: string;
  kind: 'REQUEST' | 'ORDER';
  serviceType: ServiceType;
  pickup: string;
  dropoff: string;
  status: string;
  costCents: number | null;
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
  const cityId = String(formData.get('cityId') ?? '');
  const zoneId = String(formData.get('zoneId') ?? '');
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
  const serviceType = (['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE'].includes(st) ? st : 'FOOD') as ServiceType;

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

  // Get membership benefits
  const sub = await getActiveSubscription(user.id);
  const planCode = getPlanCodeFromSubscription(sub);
  const membershipBenefits = getMembershipBenefits(planCode);

  // Calculate cost with membership discount
  const pricing = calculatePriceBreakdownCents({
    miles,
    serviceType: serviceType as 'FOOD' | 'STORE' | 'FRAGILE' | 'CONCIERGE',
    discount: membershipBenefits.discount,
    waiveServiceFee: membershipBenefits.waiveServiceFee,
  });
  const finalPriceDollars = pricing.discountedBaseCents / 100;

  // Award NIP based on membership multiplier
  const nipEarned = Math.round(finalPriceDollars * membershipBenefits.nipMultiplier);

  const created = await prisma.request.create({
    data: {
      customerId: user.id,
      pickup,
      dropoff,
      serviceType,
      notes: notes || null,
      status: RequestStatus.SUBMITTED,
      cityId: cityId || null,
      zoneId: zoneId || null,
      milesEstimate,
      costEstimate: pricing.totalCents, // Store in cents
    },
  });
  
  await prisma.requestEvent.create({
    data: { requestId: created.id, type: 'STATUS_SUBMITTED', message: 'Submitted' },
  });

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
        requestId: created.id,
      },
    });
  }
  
  revalidatePath('/requests');
  revalidatePath('/dashboard');
  
  redirect(`/requests/${created.id}`);
}

export async function getUserRequests() {
  const user = await getCurrentUser();
  if (!user) return [];

  const prisma = getPrisma();

  const [legacyRequests, orders] = await prisma.$transaction([
    prisma.request.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.deliveryRequest.findMany({
      where: { userId: user.id, status: { not: DeliveryRequestStatus.DRAFT } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const computeOrderTotalCents = (order: (typeof orders)[number]) => {
    const deliveryFee = order.deliveryFeeCents ?? 0;
    const discount = order.discountCents ?? 0;
    const receiptSubtotal =
      typeof order.receiptSubtotalCents === 'number'
        ? order.receiptSubtotalCents
        : Array.isArray(order.receiptItems)
          ? (order.receiptItems as Array<{ price?: number; quantity?: number }>).reduce(
              (sum, item) =>
                sum +
                Math.round((item.price || 0) * 100) *
                  Math.max(1, item.quantity || 1),
              0
            )
          : 0;

    const total = receiptSubtotal + deliveryFee - discount;
    return Number.isFinite(total) && total > 0 ? total : null;
  };

  const mapped: UserRequestListItem[] = [
    ...orders.map((order) => ({
      id: order.id,
      kind: 'ORDER' as const,
      serviceType: order.serviceType,
      pickup: order.pickupAddress,
      dropoff: order.dropoffAddress,
      status: order.status === DeliveryRequestStatus.CANCELED ? 'CANCELLED' : order.status,
      costCents: computeOrderTotalCents(order),
      createdAt: order.createdAt,
      href: `/track/${order.id}`,
    })),
    ...legacyRequests.map((request) => ({
      id: request.id,
      kind: 'REQUEST' as const,
      serviceType: request.serviceType,
      pickup: request.pickup,
      dropoff: request.dropoff,
      status: request.status,
      costCents: request.costEstimate ?? null,
      createdAt: request.createdAt,
      href: `/track/${request.id}`,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return mapped;
}

export async function getRequest(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const prisma = getPrisma();
  let request: any = await prisma.request.findUnique({
    where: { id },
    include: { 
      events: { orderBy: { timestamp: 'desc' } },
      assignedDriver: {
        include: {
          user: true
        }
      },
      customer: true
    },
  });

  if (!request) {
    const deliveryRequest = await prisma.deliveryRequest.findUnique({
      where: { id },
      include: {
        assignedDriver: {
          include: { user: true }
        },
        user: true
      }
    });

    if (deliveryRequest) {
      // Map DeliveryRequest to Request-like shape
      request = {
        ...deliveryRequest,
        customerId: deliveryRequest.userId,
        customer: deliveryRequest.user,
        pickup: deliveryRequest.pickupAddress,
        dropoff: deliveryRequest.dropoffAddress,
        costEstimate: deliveryRequest.deliveryFeeCents,
        events: [], // DeliveryRequest doesn't have events relation yet?
        isDeliveryRequest: true
      };
    }
  }

  if (!request) return null;

  const role = user.role;
  const isCustomer = request.customerId === user.id;
  const isAssignedDriver = request.assignedDriver?.userId === user.id;
  const isAdmin = role === 'ADMIN';

  if (!isCustomer && !isAssignedDriver && !isAdmin) {
    return null;
  }

  return request;
}
