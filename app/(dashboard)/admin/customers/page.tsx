import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';
import { formatDistanceToNow } from 'date-fns';

// Loading component for better UX
function AdminCustomersLoading() {
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

async function getCustomersData() {
  const prisma = getPrisma();
  
  try {
    // Get all customers (users who are not drivers or admins)
    const customers = await prisma.user.findMany({
      where: { 
        role: 'CUSTOMER',
        // Exclude drivers and admins
        driverProfile: null,
        // Add some basic filtering to avoid loading system users
        email: { not: { contains: 'system' } }
      },
      include: {
        _count: {
          select: {
            requests: true,
            supportTickets: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return customers;
  } catch (error) {
    console.error('[AdminCustomers] Failed to fetch customers:', error);
    throw error;
  }
}

async function CustomersList() {
  let customers: any[] = [];
  let error: unknown = null;

  try {
    customers = await getCustomersData();
  } catch (err) {
    error = err;
  }

  if (error) {
    return <CustomersErrorState error={error} />;
  }

  if (customers.length === 0) {
    return <EmptyCustomersState />;
  }

  return <CustomersTable customers={customers} />;
}

function EmptyCustomersState() {
  return (
    <OtwCard className="mt-3 p-8 text-center">
      <OtwEmptyState 
        title="No customers found" 
        subtitle="Customer accounts will appear here when users register or make requests." 
      />
    </OtwCard>
  );
}

function CustomersTable({ customers }: { customers: any[] }) {
  return (
    <OtwCard className="mt-3">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="opacity-60 border-b border-white/10">
            <tr>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Requests</th>
              <th className="text-left px-4 py-3">Support Tickets</th>
              <th className="text-left px-4 py-3">Membership</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => {
              return (
                <tr key={customer.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{customer.name || 'Guest Customer'}</div>
                      <div className="text-xs text-white/50">{customer.email}</div>
                      <div className="text-xs text-white/40">ID: {customer.id.slice(-8)}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30`}>
                      Free User
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-white/70">{customer._count.requests}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-white/70">{customer._count.supportTickets}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white/50 text-xs">No membership</span>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {formatDistanceToNow(new Date(customer.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors">
                        View
                      </button>
                      <button className="text-xs px-2 py-1 rounded bg-otwGold/20 hover:bg-otwGold/30 text-otwGold transition-colors">
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </OtwCard>
  );
}

function CustomersErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load customers</div>
      <div className="text-xs text-white/40 mt-2">
        {error instanceof Error ? error.message : 'Unknown error occurred'}
      </div>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-4 text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
      >
        Retry
      </button>
    </OtwCard>
  );
}

export default async function AdminCustomersPage() {
  await requireRole(['ADMIN']);
  
  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Customer Management" 
        subtitle="Manage customer accounts, memberships, and activity." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminCustomersLoading />}>
          <CustomersList />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}