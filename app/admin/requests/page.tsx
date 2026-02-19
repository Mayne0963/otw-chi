import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { revalidatePath } from 'next/cache';

// Loading component for better UX
function AdminRequestsLoading() {
  return (
    <OtwCard className="mt-3">
      <div className="animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded"></div>
          ))}
        </div>
      </div>
    </OtwCard>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'SUBMITTED':
    case 'REQUESTED':
      return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    case 'ASSIGNED': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'PICKED_UP': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    case 'EN_ROUTE':
    case 'IN_TRANSIT': return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
    case 'DELIVERED': return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'COMPLETED': return 'bg-green-600/20 text-green-500 border border-green-600/30';
    case 'CANCELLED':
    case 'CANCELED': return 'bg-red-500/20 text-red-400 border border-red-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
  }
}

async function getRequestsData() {
  const prisma = getPrisma();
  
  try {
    const [deliveryRequests] = await Promise.all([
      
      prisma.deliveryRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        where: { status: { not: 'DRAFT' } },
        include: {
          assignedDriver: {
            include: {
              user: { select: { name: true, email: true } }
            }
          },
          user: { select: { name: true, email: true } }
        }
      })
    ]);

    const allRequests = [...deliveryRequests].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const drivers = await prisma.driverProfile.findMany({ 
      include: { 
        user: { select: { name: true, email: true } } 
      },
      where: { status: { not: 'OFFLINE' } }
    });

    return { requests: allRequests, drivers };
  } catch (error) {
    console.error('[AdminRequests] Failed to fetch requests:', error);
    throw error;
  }
}

type RequestsData = Awaited<ReturnType<typeof getRequestsData>>;
type RequestRow = RequestsData['requests'][number];
type DriverRow = RequestsData['drivers'][number];

async function RequestsList() {
  let requests: RequestRow[] = [];
  let drivers: DriverRow[] = [];
  let error: unknown = null;

  try {
    const data = await getRequestsData();
    requests = data.requests;
    drivers = data.drivers;
  } catch (err) {
    error = err;
  }

  if (error) {
    return <RequestsErrorState error={error} />;
  }

  if (requests.length === 0) {
    return <EmptyRequestsState />;
  }

  return <RequestsTable requests={requests} drivers={drivers} />;
}

function EmptyRequestsState() {
  return (
    <OtwCard className="mt-3 p-8 text-center">
      <OtwEmptyState 
        title="No requests found" 
        subtitle="Customer delivery requests will appear here when submitted." 
      />
    </OtwCard>
  );
}

function RequestsTable({ requests, drivers }: { requests: RequestRow[], drivers: DriverRow[] }) {
  return (
    <OtwCard className="mt-3">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="opacity-60 border-b border-white/10">
            <tr>
              <th className="text-left px-4 py-3">Request</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Route</th>
              <th className="text-left px-4 py-3">Zone</th>
              <th className="text-left px-4 py-3">Driver</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium text-xs flex items-center gap-2">
                      {request.id}
                      {request.deliveryFeePaid && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">PAID</span>
                      )}
                    </div>
                    <div className="text-xs text-white/50">
                      {request.serviceType}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                    {request.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium">{request.user.name || 'Guest'}</div>
                    <div className="text-xs text-white/50">{request.user.email}</div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs">
                    <div className="truncate max-w-32" title={request.pickupAddress}>📍 {request.pickupAddress}</div>
                    <div className="truncate max-w-32" title={request.dropoffAddress}>🏠 {request.dropoffAddress}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-white/60">
                  {'-'}
                </td>
                <td className="px-4 py-3">
                  {request.assignedDriver ? (
                    <div>
                      <div className="font-medium text-sm">{request.assignedDriver.user.name}</div>
                      <div className="text-xs text-white/50">{request.assignedDriver.user.email}</div>
                    </div>
                  ) : (
                    <span className="text-white/50 text-xs">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3 text-white/60 text-xs">
                  {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <OtwButton
                      as="a"
                      href={`/admin/requests/${request.id}?id=${request.id}`}
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                    >
                      View
                    </OtwButton>
                    <OtwButton
                      as="a"
                      href={`/admin/requests/${request.id}/edit?id=${request.id}`}
                      variant="outline"
                      className="h-7 px-2 text-xs"
                    >
                      Edit
                    </OtwButton>
                    {(request.status === 'REQUESTED') && drivers.length > 0 && (
                      <form action={assignDriverAction} className="inline-block">
                        <input type="hidden" name="id" value={request.id} />
                        <select 
                          name="driverProfileId" 
                          className="text-xs rounded bg-otwBlack/40 border border-white/15 px-2 py-1"
                          onChange={(e) => {
                            if (e.target.value) {
                              e.target.form?.submit();
                            }
                          }}
                        >
                          <option value="">Assign Driver</option>
                          {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.user.name} ({driver.status})
                            </option>
                          ))}
                        </select>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OtwCard>
  );
}

function RequestsErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load requests</div>
      <div className="text-xs text-white/40 mt-2">
        {error instanceof Error ? error.message : 'Unknown error occurred'}
      </div>
      <OtwButton 
        onClick={() => window.location.reload()} 
        className="mt-4 text-xs px-3 py-2"
        variant="ghost"
      >
        Retry
      </OtwButton>
    </OtwCard>
  );
}

export async function assignDriverAction(formData: FormData) {
  'use server';
  await requireRole(['ADMIN']);
  const id = String(formData.get('id') ?? '');
  const driverProfileId = String(formData.get('driverProfileId') ?? '');
  
  if (!id || !driverProfileId) {
    console.warn('[assignDriverAction] Missing required parameters:', { id, driverProfileId });
    return;
  }
  
  try {
    const prisma = getPrisma();
    const deliveryRequest = await prisma.deliveryRequest.findUnique({ 
      where: { id },
      select: { status: true }
    });
    
    if (deliveryRequest) {
      await prisma.deliveryRequest.update({
        where: { id },
        data: { 
          assignedDriverId: driverProfileId,
          status: deliveryRequest.status === 'REQUESTED' ? 'ASSIGNED' : undefined
        }
      });

      await prisma.driverAssignment.create({
        data: {
          deliveryRequestId: id,
          driverId: driverProfileId
        }
      });
    } else {
      console.warn('[assignDriverAction] Request not found:', id);
      return;
    }

    revalidatePath('/admin/requests');
    revalidatePath(`/admin/requests/${id}`);
  } catch (error) {
    console.error('[assignDriverAction] Failed to assign driver:', error);
    throw error; // Re-throw to trigger error boundary
  }
}

export default async function AdminRequestsPage() {
  await requireRole(['ADMIN']);
  
  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Request Management" 
        subtitle="Monitor and manage customer delivery requests." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminRequestsLoading />}>
          <RequestsList />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}
