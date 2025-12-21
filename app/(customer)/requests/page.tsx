import { getUserRequests } from '@/app/actions/requests';

export const dynamic = 'force-dynamic';

import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { format } from 'date-fns';

export default async function RequestsPage() {
  const requests = await getUserRequests();

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Requests" 
        description="Track and manage your delivery requests."
        action={{ label: "New Request", href: "/requests/new" }}
      />

      <DataTable 
        data={requests}
        keyExtractor={(item) => item.id}
        emptyMessage="You haven't made any requests yet."
        columns={[
          {
            header: "ID",
            cell: (req) => <span className="font-mono text-xs text-otw-textMuted">#{req.id.slice(-6)}</span>
          },
          {
            header: "Type",
            accessorKey: "serviceType",
            cell: (req) => <Badge variant="outline">{req.serviceType}</Badge>
          },
          {
            header: "Status",
            accessorKey: "status",
            cell: (req) => {
              const status = req.status;
              let variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" = "outline";
              
              if (status === 'SUBMITTED') variant = 'secondary';
              if (status === 'ASSIGNED') variant = 'warning';
              if (status === 'DELIVERED') variant = 'success';
              if (status === 'CANCELLED') variant = 'destructive';

              return <Badge variant={variant}>{status}</Badge>;
            }
          },
          {
            header: "Pickup",
            accessorKey: "pickup",
            className: "max-w-[150px] truncate"
          },
          {
            header: "Date",
            cell: (req) => <span className="text-otw-textMuted">{format(req.createdAt, 'MMM d, yyyy')}</span>
          },
          {
            header: "Action",
            cell: (req) => (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/requests/${req.id}`}>View</Link>
              </Button>
            )
          }
        ]}
      />
    </div>
  );
}
