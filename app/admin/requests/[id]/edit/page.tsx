import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import type { DeliveryRequestStatus } from '@prisma/client';
import { getPrisma } from '@/lib/db';
import { DRIVER_ACTIVE_REQUEST_STATUSES } from '@/lib/driver-assignment';
import {
  DISPATCH_PAYMENT_REQUIRED_ERROR,
  isDispatchBlockedByPayment,
} from '@/lib/request-payment';
import { requireRole } from '@/lib/auth';
import { getCurrentUser } from '@/lib/auth/roles';
import {
  closeRequestChat,
  createSystemRequestMessage,
  DRIVER_ASSIGNED_CHAT_OPEN_MESSAGE,
} from '@/lib/request-chat';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

const statusOptions = [
  'DRAFT',
  'SUBMITTED',
  'REQUESTED', // DeliveryRequest
  'ASSIGNED',
  'PICKED_UP',
  'EN_ROUTE',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'CANCELED' // DeliveryRequest
] as const;

type RequestStatusOption = (typeof statusOptions)[number];

async function getRequestData(id: string) {
  const prisma = getPrisma();
  const request = await prisma.deliveryRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      notes: true,
      assignedDriverId: true,
      userId: true,
      paymentRequired: true,
      deliveryFeePaid: true,
      deliveryFeeCents: true,
      overageBillingMode: true,
      overageMiles: true,
      overageStatus: true,
      user: { select: { name: true, email: true } },
      assignedDriver: { select: { user: { select: { name: true, email: true } } } },
    },
  });

  const drivers = await prisma.driverProfile.findMany({
    include: { user: { select: { name: true, email: true } } }
  });

  return { request, drivers };
}

export async function updateRequestAction(formData: FormData) {
  'use server';
  await requireRole(['ADMIN']);
  const actor = await getCurrentUser();
  if (!actor) {
    throw new Error('Unauthorized');
  }

  const id = String(formData.get('id') ?? '').trim();
  const statusInput = String(formData.get('status') ?? '').trim();
  const driverIdInput = String(formData.get('assignedDriverId') ?? '').trim();
  const notesInput = String(formData.get('notes') ?? '').trim();

  if (!id) return;

  const prisma = getPrisma();
  
  // Check for DeliveryRequest
  const dr = await prisma.deliveryRequest.findUnique({
    where: { id },
    select: {
      status: true,
      assignedDriverId: true,
      userId: true,
      paymentRequired: true,
      deliveryFeePaid: true,
      deliveryFeeCents: true,
      overageBillingMode: true,
      overageMiles: true,
      overageStatus: true,
    }
  });

  if (dr) {
    const data: {
      status?: any;
      assignedDriverId?: string | null;
      notes?: string | null;
    } = {};

    if (statusOptions.includes(statusInput as RequestStatusOption)) {
       // Validate against DeliveryRequestStatus enum
       if (['DRAFT', 'REQUESTED', 'ASSIGNED', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED', 'CANCELED'].includes(statusInput)) {
         data.status = statusInput;
       }
    }

    if (driverIdInput.length > 0) {
      if (isDispatchBlockedByPayment(dr)) {
        throw new Error(DISPATCH_PAYMENT_REQUIRED_ERROR);
      }
      if (
        dr.overageBillingMode === 'INSTANT' &&
        dr.overageMiles > 0 &&
        dr.overageStatus !== 'PAID'
      ) {
        throw new Error('Request overage payment is not settled yet');
      }
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { id: driverIdInput },
        select: { id: true, userId: true },
      });
      if (!driverProfile) {
        throw new Error('Driver not found');
      }
      if (driverProfile.userId === dr.userId) {
        throw new Error('Drivers cannot accept their own requests');
      }
      const nextStatus = (data.status ?? dr.status) as DeliveryRequestStatus;
      if (DRIVER_ACTIVE_REQUEST_STATUSES.includes(nextStatus)) {
        const activeRequest = await prisma.deliveryRequest.findFirst({
          where: {
            assignedDriverId: driverProfile.id,
            status: { in: DRIVER_ACTIVE_REQUEST_STATUSES },
            id: { not: id },
          },
          select: { id: true },
        });
        if (activeRequest) {
          throw new Error('Driver already has an active request');
        }
      }
    }

    data.assignedDriverId = driverIdInput.length > 0 ? driverIdInput : null;
    data.notes = notesInput.length > 0 ? notesInput : null;

    const updatedRequest = await prisma.deliveryRequest.update({
      where: { id },
      data
    });
    
    // Update driver assignment relation if driver changed
    if (data.assignedDriverId && data.assignedDriverId !== dr.assignedDriverId) {
        await prisma.driverAssignment.create({
            data: {
                deliveryRequestId: id,
                driverId: data.assignedDriverId
            }
        });
    }

    const nextStatus = (updatedRequest.status ?? dr.status) as DeliveryRequestStatus;
    const transitionedIntoAssigned =
      nextStatus === 'ASSIGNED' && (dr.status !== 'ASSIGNED' || dr.assignedDriverId !== updatedRequest.assignedDriverId);

    if (transitionedIntoAssigned) {
      await prisma.deliveryRequest.update({
        where: { id },
        data: {
          chatEnabled: true,
          chatClosedAt: null,
        },
      });

      await createSystemRequestMessage(prisma, {
        deliveryRequestId: id,
        senderUserId: actor.id,
        senderRole: actor.role,
        messageText: DRIVER_ASSIGNED_CHAT_OPEN_MESSAGE,
      });
    }

    if (nextStatus === 'DELIVERED' || nextStatus === 'CANCELED') {
      await closeRequestChat(prisma, {
        deliveryRequestId: id,
        senderUserId: actor.id,
        senderRole: actor.role,
      });
    }
  }

  revalidatePath('/admin/requests');
  revalidatePath(`/admin/requests/${id}`);
  revalidatePath(`/admin/requests/${id}/edit`);
  redirect(`/admin/requests/${id}`);
}

export default async function AdminRequestEditPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { id?: string };
}) {
  await requireRole(['ADMIN']);

  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const headerList = await headers();
  const rawUrl =
    headerList.get('x-forwarded-path') ||
    headerList.get('x-forwarded-uri') ||
    headerList.get('x-original-url') ||
    headerList.get('next-url') ||
    headerList.get('x-nextjs-invoke-path') ||
    headerList.get('x-invoke-path') ||
    headerList.get('x-url') ||
    headerList.get('referer') ||
    '';
  let derivedId = '';

  if (rawUrl) {
    try {
      const path = rawUrl.startsWith('http')
        ? new URL(rawUrl).pathname
        : rawUrl.split('?')[0] ?? '';
      const parts = path.split('/').filter(Boolean);
      const requestIndex = parts.indexOf('requests');
      derivedId = requestIndex >= 0 ? parts[requestIndex + 1] ?? '' : '';
    } catch {
      derivedId = '';
    }
  }

  const resolvedId = resolvedParams?.id || resolvedSearchParams?.id || derivedId;

  if (!resolvedId) {
    return (
      <OtwPageShell>
        <OtwSectionHeader
          title="Edit Request"
          subtitle="Update assignment, status, and notes."
        />
        <OtwCard className="mt-4 p-6">
          <OtwEmptyState
            title="Request ID missing"
            subtitle="This request link is missing an identifier."
          />
        </OtwCard>
      </OtwPageShell>
    );
  }

  const { request, drivers } = await getRequestData(resolvedId);

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Edit Request"
        subtitle="Update assignment, status, and notes."
      />

      <div className="mt-6 flex items-center gap-2">
        <Link
          href={`/admin/requests/${resolvedId}?id=${resolvedId}`}
          className="text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Back to Details
        </Link>
        <Link
          href="/admin/requests"
          className="text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Back to Requests
        </Link>
      </div>

      <OtwCard className="mt-4 p-6">
        {!request ? (
          <OtwEmptyState
            title="Request not found"
            subtitle="This delivery request could not be located."
          />
        ) : (
          <form action={updateRequestAction} className="space-y-5">
            <input type="hidden" name="id" value={request.id} />

            <div>
              <label className="text-xs text-white/60">Request</label>
              <div className="mt-2 text-sm text-white">
                {request.user.name || 'Guest'} ({request.user.email})
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">Status</label>
              <select
                name="status"
                defaultValue={request.status}
                className="mt-2 w-full rounded bg-otwBlack/40 border border-white/15 px-3 py-2 text-sm"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60">Assigned Driver</label>
              <select
                name="assignedDriverId"
                defaultValue={request.assignedDriverId ?? ''}
                className="mt-2 w-full rounded bg-otwBlack/40 border border-white/15 px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.user.name || 'Driver'} ({driver.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60">Notes</label>
              <textarea
                name="notes"
                defaultValue={request.notes ?? ''}
                rows={4}
                className="mt-2 w-full rounded bg-otwBlack/40 border border-white/15 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="text-sm px-4 py-2 rounded bg-otwGold/20 hover:bg-otwGold/30 text-otwGold transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}
