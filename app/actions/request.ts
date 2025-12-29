'use server';

import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { calculatePriceBreakdownCents } from '@/lib/pricing';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ServiceType, RequestStatus } from '@prisma/client';


export async function createRequestAction(formData: FormData) {
  const pickup = String(formData.get('pickup') ?? '');
  const dropoff = String(formData.get('dropoff') ?? '');
  const st = String(formData.get('serviceType') ?? 'FOOD').toUpperCase();
  const notes = String(formData.get('notes') ?? '');
  const cityId = String(formData.get('cityId') ?? '');
  const zoneId = String(formData.get('zoneId') ?? '');
  const milesInput = Number(formData.get('miles') ?? '');
  
  // Validate service type
  const serviceType = (['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE'].includes(st) ? st : 'FOOD') as ServiceType;

  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const prisma = getPrisma();

  const fallbackMiles = Math.max(0, Math.round(((pickup + dropoff + (notes || '')).length / 32) * 10));
  const miles = Number.isFinite(milesInput) && milesInput > 0 ? milesInput : fallbackMiles;
  const milesEstimate = Math.max(0, Math.round(miles));

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
  return prisma.request.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRequest(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const prisma = getPrisma();
  const request = await prisma.request.findUnique({
    where: { id },
    include: { 
      events: { orderBy: { timestamp: 'desc' } },
      assignedDriver: {
        include: {
          user: true
        }
      }
    },
  });

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
