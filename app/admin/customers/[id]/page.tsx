import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

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

export default async function AdminCustomerDetailPage({
  params
}: {
  params: { id: string };
}) {
  await requireRole(['ADMIN']);

  const customer = await getCustomer(params.id);

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
            href={`/admin/customers/${customer.id}/edit`}
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
    </OtwPageShell>
  );
}
