import { getUserRequests } from '@/app/actions/request';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Package } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  const requests = await getUserRequests();

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Requests" 
        subtitle="Track and manage your deliveries and past orders."
        action={{ label: "Place Order", href: "/order" }}
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No requests found"
          description="You haven't placed any deliveries yet."
          action={{ label: "Place your first order", href: "/order" }}
        />
      ) : (
        <div className="rounded-md border border-white/10 bg-white/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
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
                    <Badge variant={
                      request.status === 'COMPLETED' || request.status === 'DELIVERED' ? 'success' :
                      request.status === 'CANCELLED' || request.status === 'CANCELED' ? 'destructive' :
                      request.status === 'ASSIGNED' || request.status === 'PICKED_UP' || request.status === 'EN_ROUTE' ? 'secondary' :
                      'outline'
                    }>
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {typeof request.costCents === 'number' ? formatCurrency(request.costCents) : '-'}
                  </TableCell>
                  <TableCell className="text-white/60 text-xs">
                    {formatDate(request.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={request.href}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
