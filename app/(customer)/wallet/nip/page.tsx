import { getWalletBalance, getWalletHistory } from '@/app/actions/wallet';

export const dynamic = 'force-dynamic';

import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Wallet, TrendingUp, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';

export default async function NipWalletPage() {
  const balance = await getWalletBalance();
  const history = await getWalletHistory();

  return (
    <div className="space-y-8">
      <PageHeader 
        title="NIP Wallet" 
        description="Manage your rewards and transaction history." 
      />

      {/* Balance Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Current Balance" 
          value={balance.toLocaleString()} 
          icon={Wallet}
          trend="Available"
          trendUp={true}
          className="md:col-span-1"
        />
        
        {/* Static Info Cards */}
        <div className="bg-otw-panel p-6 rounded-2xl border border-otw-border shadow-otwSoft md:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full bg-otw-success/10 text-otw-success">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-otw-text">How to Earn</h3>
          </div>
          <ul className="text-sm text-otw-textMuted space-y-2">
            <li>• Complete deliveries (Drivers)</li>
            <li>• Refer friends and family</li>
            <li>• Participate in community events</li>
          </ul>
        </div>

        <div className="bg-otw-panel p-6 rounded-2xl border border-otw-border shadow-otwSoft md:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full bg-otw-primary/10 text-otw-primary">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-otw-text">How to Spend</h3>
          </div>
          <ul className="text-sm text-otw-textMuted space-y-2">
            <li>• Redeem for delivery discounts</li>
            <li>• Purchase exclusive merchandise</li>
            <li>• Donate to local charities</li>
          </ul>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-otw-text">Transaction History</h2>
        <DataTable 
          data={history}
          keyExtractor={(item) => item.id}
          emptyMessage="No transactions found."
          columns={[
            {
              header: "Date",
              cell: (item) => <span className="text-otw-textMuted">{format(item.createdAt, 'MMM d, yyyy h:mm a')}</span>
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
              header: "Reference / Reason",
              accessorKey: "requestId", // Using requestId as the generic reference/reason field
              cell: (item) => <span className="text-otw-textMuted text-sm">{item.requestId || '-'}</span>
            }
          ]}
        />
      </div>
    </div>
  );
}
