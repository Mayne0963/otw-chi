import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

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
  params
}: {
  params: { id: string };
}) {
  await requireRole(['ADMIN']);

  if (!params?.id) {
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

  const request = await getRequest(params.id);

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Request Details"
        subtitle="Review customer request, route, and assignment."
      />

      <div className="mt-6 flex items-center gap-2">
        <Link
          href="/admin/requests"
          className="text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Back to Requests
        </Link>
        {request && (
          <Link
            href={`/admin/requests/${request.id}/edit`}
            className="text-xs px-3 py-2 rounded bg-otwGold/20 hover:bg-otwGold/30 text-otwGold transition-colors"
          >
            Edit Request
          </Link>
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
