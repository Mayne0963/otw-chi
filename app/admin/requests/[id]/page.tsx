import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

async function refundRequestAction(formData: FormData) {
  'use server';
  await requireRole(['ADMIN']);
  const id = String(formData.get('id'));
  const isDelivery = String(formData.get('isDelivery')) === 'true';

  const prisma = getPrisma();

  try {
    if (isDelivery) {
      await prisma.deliveryRequest.update({
        where: { id },
        data: { status: 'CANCELED' }
      });
    } else {
      await prisma.request.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });
    }
  } catch (error) {
    console.error('Failed to cancel request:', error);
  }

  revalidatePath(`/admin/requests/${id}`);
}

async function getRequest(id: string) {
  const prisma = getPrisma();
  return prisma.request.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, email: true } },
      assignedDriver: {
        include: { user: { select: { name: true, email: true } } }
      },
      zone: { select: { name: true } },
      city: { select: { name: true } }
    }
  });
}

export default async function AdminRequestDetailPage({
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
          title="Request Details"
          subtitle="Review customer request, route, and assignment."
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

  const request = await getRequest(resolvedId) as any;

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Request Details"
        subtitle="Review customer request, route, and assignment."
      />

      <div className="mt-6 flex items-center gap-2">
        <OtwButton
          as="a"
          href="/admin/requests"
          variant="ghost"
          className="text-xs px-3 py-2"
        >
          Back to Requests
        </OtwButton>
        {request && (
          <>
            <OtwButton
              as="a"
              href={`/admin/requests/${resolvedId}/edit?id=${resolvedId}`}
              variant="gold"
              className="text-xs px-3 py-2"
            >
              Edit Request
            </OtwButton>
            {!['CANCELLED', 'CANCELED', 'COMPLETED', 'DELIVERED'].includes(request.status) && (
              <form action={refundRequestAction}>
                <input type="hidden" name="id" value={resolvedId} />
                <input type="hidden" name="isDelivery" value={String(!!request.isDeliveryRequest)} />
                <OtwButton 
                  variant="red" 
                  type="submit"
                  className="h-8 text-xs"
                >
                  Cancel & Refund
                </OtwButton>
              </form>
            )}
          </>
        )}
      </div>

      <OtwCard className="mt-4 p-6">
        {!request ? (
          <OtwEmptyState
            title="Request not found"
            subtitle="This delivery request could not be located."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <div className="text-lg font-semibold text-white">Request {request.id}</div>
              <div className="text-xs text-white/50">
                Created {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Status</div>
                <div className="text-sm text-white">{request.status}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Service Type</div>
                <div className="text-sm text-white">{request.serviceType}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Miles Estimate</div>
                <div className="text-sm text-white">
                  {typeof request.milesEstimate === 'number'
                    ? `${request.milesEstimate.toFixed(1)} mi`
                    : 'Not set'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Pickup</div>
                <div className="mt-2 text-sm text-white">{request.pickup}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Dropoff</div>
                <div className="mt-2 text-sm text-white">{request.dropoff}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Customer</div>
                <div className="mt-2 text-sm text-white">
                  {request.customer.name || 'Guest'}
                </div>
                <div className="text-xs text-white/50">{request.customer.email}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Driver</div>
                {request.assignedDriver ? (
                  <div className="mt-2 text-sm text-white">
                    {request.assignedDriver.user.name}
                    <div className="text-xs text-white/50">
                      {request.assignedDriver.user.email}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-white/60">Unassigned</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">City</div>
                <div className="mt-2 text-sm text-white">{request.city?.name || 'Unassigned'}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Zone</div>
                <div className="mt-2 text-sm text-white">{request.zone?.name || 'Unassigned'}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Estimated Cost</div>
                <div className="mt-2 text-sm text-white">
                  {typeof request.costEstimate === 'number'
                    ? `$${(request.costEstimate / 100).toFixed(2)}`
                    : 'Not set'}
                </div>
              </div>
            </div>

            {/* Payment Details for DeliveryRequest */}
            {request.isDeliveryRequest && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-white/5">
                  <div className="text-xs text-white/50">Payment Status</div>
                  <div className="mt-2 text-sm">
                    {request.deliveryFeePaid ? (
                      <span className="text-green-400 font-medium">Paid</span>
                    ) : (
                      <span className="text-yellow-400 font-medium">Unpaid</span>
                    )}
                  </div>
                </div>
                {request.receiptSubtotalCents && (
                   <div className="p-4 rounded-lg bg-white/5">
                    <div className="text-xs text-white/50">Receipt Subtotal</div>
                    <div className="mt-2 text-sm text-white">
                      ${(request.receiptSubtotalCents / 100).toFixed(2)}
                    </div>
                  </div>
                )}
                 <div className="p-4 rounded-lg bg-white/5">
                  <div className="text-xs text-white/50">Coupon</div>
                  <div className="mt-2 text-sm text-white">
                    {request.couponCode || 'None'}
                  </div>
                </div>
              </div>
            )}

            {request.notes && (
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Notes</div>
                <div className="mt-2 text-sm text-white/80">{request.notes}</div>
              </div>
            )}
          </div>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}
