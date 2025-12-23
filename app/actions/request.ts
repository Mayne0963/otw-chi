'use server';

import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { getActiveSubscription, getMembershipBenefits, getPlanCodeFromSubscription } from '@/lib/membership';
import { estimatePrice } from '@/lib/pricing';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ServiceType, RequestStatus } from '@/lib/generated/prisma';

export async function createRequestAction(formData: FormData) {
  const pickup = String(formData.get('pickup') ?? '');
  const dropoff = String(formData.get('dropoff') ?? '');
  const st = String(formData.get('serviceType') ?? 'FOOD').toUpperCase();
  const notes = String(formData.get('notes') ?? '');
  const cityId = String(formData.get('cityId') ?? '');
  const zoneId = String(formData.get('zoneId') ?? '');
  
  // Validate service type
  const serviceType = (['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE'].includes(st) ? st : 'FOOD') as ServiceType;

  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const prisma = getPrisma();

  // Calculate miles (placeholder heuristic)
  const miles = Math.max(0, Math.round(((pickup + dropoff + (notes || '')).length / 32) * 10));

  // Get membership benefits
  const sub = await getActiveSubscription(user.id);
  const planCode = getPlanCodeFromSubscription(sub);
  const membershipBenefits = getMembershipBenefits(planCode);

  // Calculate cost with membership discount
  const basePrice = estimatePrice({ miles, serviceType: serviceType as any, tier: 'BASIC' });
  const finalPrice = basePrice * (1 - membershipBenefits.discount);

  // Award NIP based on membership multiplier
  const nipEarned = Math.round(finalPrice * membershipBenefits.nipMultiplier);

  // Check if service fee should be waived for EXEC members
  const serviceFee = membershipBenefits.waiveServiceFee ? 0 : 2.99; // $2.99 service fee
  const totalPrice = finalPrice + serviceFee;

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
      milesEstimate: miles,
      costEstimate: Math.round(totalPrice * 100), // Store in cents
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
