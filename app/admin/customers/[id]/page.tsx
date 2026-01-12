import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';
import { headers } from 'next/headers';

async function getCustomer(id: string) {
  const prisma = getPrisma();
  return prisma.user.findUnique({
    where: { id },
    include: {
      membership: {
        include: {
          plan: { select: { name: true } }
        }
      },
      customerProfile: true,
      _count: {
        select: {
          requests: true,
          supportTickets: true
        }
      }
    }
  });
}

async function getCustomerRequests(customerId: string) {
  const prisma = getPrisma();
  
  const [requests, deliveryRequests] = await Promise.all([
    prisma.request.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        assignedDriver: {
          include: { user: { select: { name: true } } }
        }
      }
    }),
    prisma.deliveryRequest.findMany({
      where: { userId: customerId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        assignedDriver: {
          include: { user: { select: { name: true } } }
        }
      }
    })
  ]);

  // Merge and sort
  return [...requests.map(r => ({ ...r, type: 'RIDE' })), ...deliveryRequests.map(r => ({ ...r, type: 'DELIVERY' }))]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
}

export default async function AdminCustomerDetailPage({
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
      const customerIndex = parts.indexOf('customers');
      derivedId = customerIndex >= 0 ? parts[customerIndex + 1] ?? '' : '';
    } catch {
      derivedId = '';
    }
  }

  const resolvedId = resolvedParams?.id || resolvedSearchParams?.id || derivedId;

  if (!resolvedId) {
    return (
      <OtwPageShell>
        <OtwSectionHeader
          title="Customer Details"
          subtitle="Review customer profile, membership, and activity."
        />
        <OtwCard className="mt-4 p-6">
          <OtwEmptyState
            title="Customer ID missing"
            subtitle="This customer link is missing an identifier."
          />
        </OtwCard>
      </OtwPageShell>
    );
  }

  const customer = await getCustomer(resolvedId);
  const requests = customer ? await getCustomerRequests(customer.id) : [];

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Customer Details"
        subtitle="Review customer profile, membership, and activity."
      />

      <div className="mt-6 flex items-center gap-2">
        <Link
          href="/admin/customers"
          className="text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Back to Customers
        </Link>
        {customer && (
          <Link
            href={`/admin/customers/${resolvedId}/edit?id=${resolvedId}`}
            className="text-xs px-3 py-2 rounded bg-otwGold/20 hover:bg-otwGold/30 text-otwGold transition-colors"
          >
            Edit Customer
          </Link>
        )}
      </div>

      <OtwCard className="mt-4 p-6">
        {!customer ? (
          <OtwEmptyState
            title="Customer not found"
            subtitle="This customer record could not be located."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <div className="text-xl font-semibold text-white">
                {customer.name || 'Guest Customer'}
              </div>
              <div className="text-sm text-white/60">{customer.email}</div>
              <div className="text-xs text-white/40">ID: {customer.id}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Role</div>
                <div className="text-sm font-medium text-white">{customer.role}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Joined</div>
                <div className="text-sm text-white">
                  {formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Support Tickets</div>
                <div className="text-sm text-white">{customer._count.supportTickets}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Membership</div>
                {customer.membership ? (
                  <div className="mt-2">
                    <div className="text-sm font-medium text-white">
                      {customer.membership.plan?.name || 'Membership'}
                    </div>
                    <div className="text-xs text-white/50">
                      Status: {customer.membership.status}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-white/60 mt-2">No active membership</div>
                )}
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Request Activity</div>
                <div className="mt-2 text-sm text-white">
                  Total requests: {customer._count.requests}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white/5">
              <div className="text-xs text-white/50">Contact Preferences</div>
              <div className="mt-2 text-sm text-white/70">
                Phone: {customer.customerProfile?.phone || 'Not set'}
              </div>
              <div className="mt-1 text-sm text-white/70">
                Default pickup: {customer.customerProfile?.defaultPickup || 'Not set'}
              </div>
              <div className="mt-1 text-sm text-white/70">
                Default dropoff: {customer.customerProfile?.defaultDropoff || 'Not set'}
              </div>
            </div>
          </div>
        )}
      </OtwCard>

      {requests.length > 0 && (
        <OtwCard className="mt-6 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Requests</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="opacity-60 border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Service</th>
                  <th className="text-left px-4 py-3">Driver</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white/70">
                      {format(new Date(req.createdAt), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        req.type === 'RIDE' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {req.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        ['COMPLETED', 'DELIVERED'].includes(req.status)
                          ? 'bg-green-500/20 text-green-400'
                          : ['CANCELLED', 'CANCELED'].includes(req.status)
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/80">{req.serviceType}</td>
                    <td className="px-4 py-3 text-white/60">
                      {req.assignedDriver?.user?.name || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3">
                      <Link 
                        href={`/admin/requests/${req.id}`}
                        className="text-otwGold hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OtwCard>
      )}
    </OtwPageShell>
  );
}
