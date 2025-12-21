'use server';

import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { ServiceType, RequestStatus } from '@/lib/generated/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function createRequest(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  const prisma = getPrisma();

  const serviceType = formData.get('serviceType') as ServiceType;
  const pickup = formData.get('pickup') as string;
  const dropoff = formData.get('dropoff') as string;
  const notes = formData.get('notes') as string;

  // Pricing Logic (Placeholder)
  // Base 799 cents. Miles unknown -> cost unknown (pending).
  // If we wanted to mock miles:
  // const miles = Math.floor(Math.random() * 10) + 1;
  // const cost = 799 + (miles * 199);
  
  // Per instructions: "If miles missing, display 'Estimate pending'"
  // So we leave milesEstimate and costEstimate as null for now.

  const request = await prisma.request.create({
    data: {
      customerId: user.id,
      serviceType,
      pickup,
      dropoff,
      notes,
      status: RequestStatus.SUBMITTED,
      // milesEstimate: null,
      // costEstimate: null,
    },
  });
  
  // Create initial event
  await prisma.requestEvent.create({
    data: {
      requestId: request.id,
      type: 'CREATED',
      message: 'Request submitted by customer',
    },
  });

  revalidatePath('/requests');
  redirect(`/requests/${request.id}`);
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
    include: { events: { orderBy: { timestamp: 'desc' } } },
  });

  if (!request || request.customerId !== user.id) {
    return null;
  }

  return request;
}

export async function cancelRequest(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const prisma = getPrisma();
  const request = await prisma.request.findUnique({ where: { id } });

  if (!request || request.customerId !== user.id) {
    throw new Error('Not found or unauthorized');
  }

  if (request.status !== RequestStatus.SUBMITTED && request.status !== RequestStatus.DRAFT) {
    throw new Error('Cannot cancel request in current status');
  }

  await prisma.request.update({
    where: { id },
    data: { status: RequestStatus.CANCELLED },
  });

  await prisma.requestEvent.create({
    data: {
      requestId: id,
      type: 'CANCELLED',
      message: 'Request cancelled by customer',
    },
  });

  revalidatePath(`/requests/${id}`);
  revalidatePath('/requests');
}
