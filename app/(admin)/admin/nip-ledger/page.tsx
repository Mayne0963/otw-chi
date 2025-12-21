import { getAdminLedger } from '@/app/actions/wallet';
import { requireRole } from '@/lib/auth/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { NipAdjustmentForm } from '@/components/admin/NipAdjustmentForm';
import { Search } from 'lucide-react';
import { format } from 'date-fns';

export default async function AdminNipLedgerPage({
  searchParams,
}: {
  searchParams: { query?: string };
}) {
  await requireRole(['ADMIN']);
  
  const query = searchParams.query || '';
  const transactions = await getAdminLedger(query);

  return (
    <div className="space-y-8">
      <PageHeader 
        title="NIP Ledger Management" 
        description="View all transactions and manage user balances." 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Adjustment Form */}
        <div className="lg:col-span-1">
          <NipAdjustmentForm />
        </div>

        {/* Right Column: Ledger Table & Filter */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-otw-panel border border-otw-border rounded-3xl p-6 shadow-otwSoft">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-bold text-otw-text">Ledger Entries</h2>
              
              <form className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-otw-textMuted" />
                  <input 
                    name="query" 
                    defaultValue={query}
                    placeholder="Filter by email, name, ID..." 
                    className="w-full bg-otw-bg border border-otw-border rounded-xl pl-9 pr-4 py-2 text-sm text-otw-text focus:outline-none focus:ring-2 focus:ring-otw-primary"
                  />
                </div>
                <Button type="submit" size="sm">Filter</Button>
              </form>
            </div>

            <DataTable 
              data={transactions}
              keyExtractor={(item) => item.id}
              emptyMessage="No transactions found matching criteria."
              columns={[
                {
                  header: "Date",
                  cell: (item) => <span className="text-xs text-otw-textMuted">{format(item.createdAt, 'MMM d, h:mm a')}</span>
                },
                {
                  header: "User",
                  cell: (item) => (
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-otw-text">{item.user.name || 'Unknown'}</span>
                      <span className="text-xs text-otw-textMuted truncate max-w-[150px]">{item.user.email}</span>
                    </div>
                  )
                },
                {
                  header: "Type",
                  accessorKey: "type",
                  cell: (item) => {
                    let variant: "default" | "secondary" | "success" | "destructive" | "outline" | "warning" = "outline";
                    if (item.type === 'EARN') variant = 'success';
                    if (item.type === 'SPEND') variant = 'destructive';
                    if (item.type === 'ADJUST') variant = 'warning';
                    return <Badge variant={variant}>{item.type}</Badge>;
                  }
                },
                {
                  header: "Amount",
                  accessorKey: "amount",
                  cell: (item) => (
                    <span className={`font-mono font-medium ${item.amount > 0 ? 'text-otw-success' : 'text-otw-error'}`}>
                      {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}
                    </span>
                  )
                },
                {
                  header: "Reason",
                  accessorKey: "requestId",
                  cell: (item) => <span className="text-xs text-otw-textMuted truncate max-w-[150px]">{item.requestId || '-'}</span>
                }
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
