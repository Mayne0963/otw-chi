import { getUserRequests } from '@/app/actions/request';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  const requests = await getUserRequests();

  return (
    <OtwPageShell>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <OtwSectionHeader 
            title="My Requests" 
            subtitle="Track and manage your deliveries and past orders."
          />
          <OtwButton as="a" href="/order" variant="gold">
              Place Order
          </OtwButton>
      </div>

      {requests.length === 0 ? (
        <OtwCard>
            <OtwEmptyState
              title="No requests found"
              subtitle="You haven't placed any deliveries yet."
              actionLabel="Place your first order"
              actionHref="/order"
            />
        </OtwCard>
      ) : (
        <OtwCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-white/50">Service</TableHead>
                    <TableHead className="text-white/50">Type</TableHead>
                    <TableHead className="text-white/50">Route</TableHead>
                    <TableHead className="text-white/50">Status</TableHead>
                    <TableHead className="text-white/50">Cost</TableHead>
                    <TableHead className="text-white/50">Date</TableHead>
                    <TableHead className="text-right text-white/50">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">
                            {request.serviceType === 'FOOD' ? '🍔' : 
                             request.serviceType === 'STORE' ? '🛒' : 
                             request.serviceType === 'FRAGILE' ? '📦' : '🏁'}
                          </span>
                          {request.serviceType}
                        </div>
                      </TableCell>
                      <TableCell className="text-white/70 text-xs">
                        {request.kind === 'ORDER' ? 'Order' : 'Request'}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="text-white/80 truncate max-w-[150px]">{request.pickup}</div>
                          <div className="text-white/50 text-[10px]">to</div>
                          <div className="text-white/80 truncate max-w-[150px]">{request.dropoff}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                          request.status === 'COMPLETED' || request.status === 'DELIVERED' ? 'bg-green-500/20 text-green-400' :
                          request.status === 'CANCELLED' || request.status === 'CANCELED' ? 'bg-red-500/20 text-red-400' :
                          request.status === 'ASSIGNED' || request.status === 'PICKED_UP' || request.status === 'EN_ROUTE' ? 'bg-otwGold/20 text-otwGold' :
                          'bg-white/10 text-white/70'
                        }`}>
                          {request.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-white">
                        {typeof request.costCents === 'number' ? formatCurrency(request.costCents) : '-'}
                      </TableCell>
                      <TableCell className="text-white/60 text-xs">
                        {formatDate(request.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <OtwButton as="a" href={request.href} variant="ghost" size="sm">
                          View
                        </OtwButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </div>
        </OtwCard>
      )}
    </OtwPageShell>
  );
}
