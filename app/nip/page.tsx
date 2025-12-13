"use client";
import { useState, useEffect } from 'react';
import { Wallet, Clock, TrendingUp, User, Car } from 'lucide-react';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import OtwButton from '@/components/ui/otw/OtwButton';

interface NipWallet {
  balance: number;
  totalEarned: number;
}

interface NipLedgerEntry {
  id: string;
  type: 'EARNED' | 'SPENT' | 'TRANSFERRED';
  amount: number;
  description: string;
  timestamp: string;
  role: 'CUSTOMER' | 'DRIVER';
}

interface NipSummary {
  customerWallet: NipWallet;
  driverWallet: NipWallet;
  recentLedger: NipLedgerEntry[];
}

const amountTone = {
  EARNED: 'text-green-400',
  SPENT: 'text-otwRed',
  TRANSFERRED: 'text-purple-400'
} as const;

export default function NipDashboardPage() {
  const [activeView, setActiveView] = useState<'CUSTOMER' | 'DRIVER'>('CUSTOMER');
  const [summary, setSummary] = useState<NipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);

  useEffect(() => {
    initIdsAndFetch();
  }, []);

  const initIdsAndFetch = async () => {
    try {
      const reqRes = await fetch('/api/otw/requests');
      const reqData = await reqRes.json();
      if (reqRes.ok && reqData.success && Array.isArray(reqData.requests) && reqData.requests.length > 0) {
        const first = reqData.requests[0];
        setActiveCustomerId(first.customerId || null);
        const assigned = reqData.requests.find((r: any) => r.assignedDriverId);
        setActiveDriverId(assigned?.assignedDriverId || null);
      }
      await fetchSummaryForCustomer();
    } catch (err) {
      setError('Failed to initialize NIP dashboard');
      console.error('Failed to initialize NIP dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummaryForCustomer = async () => {
    if (!activeCustomerId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/otw/nip/summary?customerId=${encodeURIComponent(activeCustomerId)}`);
      const data = await response.json();
      if (data.success) {
        const ledger = (data.ledger || []).map((e: any) => ({
          id: e.id,
          type: 'EARNED' as const,
          amount: Math.abs(e.delta || 0),
          description: e.reason || 'NIP transaction',
          timestamp: e.createdAt,
          role: 'CUSTOMER' as const,
        }));
        setSummary({
          customerWallet: data.wallet || { balance: 0, totalEarned: 0 },
          driverWallet: summary?.driverWallet || { balance: 0, totalEarned: 0 },
          recentLedger: ledger,
        });
      } else {
        setError(data.error || 'Failed to load NIP data');
      }
    } catch (err) {
      setError('Failed to fetch customer NIP summary');
      console.error('Failed to fetch customer NIP summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummaryForDriver = async () => {
    try {
      setLoading(true);
      setError(null);
      let driverId = activeDriverId;
      if (!driverId) {
        const res = await fetch('/api/otw/drivers/franchise');
        const data = await res.json();
        if (res.ok && data.success && data.mode === 'overview' && Array.isArray(data.drivers) && data.drivers.length > 0) {
          driverId = data.drivers[0].driverId;
          setActiveDriverId(driverId);
        }
      }
      if (!driverId) {
        setError('No driver available for NIP summary');
        setLoading(false);
        return;
      }
      const response = await fetch(`/api/otw/nip/summary?driverId=${encodeURIComponent(driverId)}`);
      const data = await response.json();
      if (data.success) {
        const ledger = (data.ledger || []).map((e: any) => ({
          id: e.id,
          type: 'EARNED' as const,
          amount: Math.abs(e.delta || 0),
          description: e.reason || 'NIP transaction',
          timestamp: e.createdAt,
          role: 'DRIVER' as const,
        }));
        setSummary({
          customerWallet: summary?.customerWallet || { balance: 0, totalEarned: 0 },
          driverWallet: data.wallet || { balance: 0, totalEarned: 0 },
          recentLedger: ledger,
        });
      } else {
        setError(data.error || 'Failed to load NIP data');
      }
    } catch (err) {
      setError('Failed to fetch driver NIP summary');
      console.error('Failed to fetch driver NIP summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type: string) => {
    const cls = 'h-4 w-4 text-otwOffWhite/80';
    switch (type) {
      case 'EARNED':
        return <TrendingUp className={cls} />;
      case 'SPENT':
        return <Wallet className={cls} />;
      case 'TRANSFERRED':
        return <Clock className={cls} />;
      default:
        return <Wallet className={cls} />;
    }
  };

  if (loading) {
    return (
      <OtwPageShell header={<OtwSectionHeader title="NIP Dashboard" subtitle="Your OTW Rewards & Transactions" />}>
        <OtwCard>Loading NIP Dashboard...</OtwCard>
      </OtwPageShell>
    );
  }

  if (error) {
    return (
      <OtwPageShell header={<OtwSectionHeader title="NIP Dashboard" subtitle="Your OTW Rewards & Transactions" />}>
        <OtwCard variant="red">{error}</OtwCard>
      </OtwPageShell>
    );
  }

  if (!summary) {
    return (
      <OtwPageShell header={<OtwSectionHeader title="NIP Dashboard" subtitle="Your OTW Rewards & Transactions" />}>
        <OtwEmptyState
          title="No NIP data yet"
          subtitle="Complete OTW runs or join a tier to start earning."
          actionHref="/customer"
          actionLabel="Go to Customer Requests"
        />
      </OtwPageShell>
    );
  }

  const currentWallet = activeView === 'CUSTOMER' ? summary.customerWallet : summary.driverWallet;
  const relevantLedger = summary.recentLedger.filter(entry => entry.role === activeView);

  return (
    <OtwPageShell header={<OtwSectionHeader title="NIP Dashboard" subtitle="Your OTW Rewards & Transactions" />}>
      <div className="flex justify-center gap-2">
        <OtwButton
          variant={activeView === 'CUSTOMER' ? 'gold' : 'outline'}
          onClick={() => setActiveView('CUSTOMER')}
        >
          <User className="mr-2 h-4 w-4" /> Customer
        </OtwButton>
        <OtwButton
          variant={activeView === 'DRIVER' ? 'gold' : 'outline'}
          onClick={async () => { setActiveView('DRIVER'); await fetchSummaryForDriver(); }}
        >
          <Car className="mr-2 h-4 w-4" /> Driver
        </OtwButton>
      </div>

      <OtwCard>
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5 text-otwGold" />
          <h2 className="text-lg font-semibold">NIP Wallet</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-xs opacity-70">Current Balance</span>
            <span className="block text-3xl font-bold">{currentWallet.balance.toLocaleString()}</span>
            <span className="text-xs opacity-60">NIP</span>
          </div>
          <div>
            <span className="block text-xs opacity-70">Total Earned</span>
            <span className="block text-2xl font-semibold text-green-400">{currentWallet.totalEarned.toLocaleString()}</span>
            <span className="text-xs opacity-60">NIP</span>
          </div>
        </div>
      </OtwCard>

      <OtwCard>
        <h3 className="text-lg font-semibold mb-3">Recent Transactions</h3>
        {relevantLedger.length === 0 ? (
          <OtwEmptyState
            title="No NIP data yet"
            subtitle="Complete OTW runs or join a tier to start earning."
            actionHref="/customer"
            actionLabel="Go to Customer Requests"
          />
        ) : (
          <div className="space-y-3">
            {relevantLedger.map((entry) => (
              <OtwCard key={entry.id} variant="ghost" className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-otwBlack/40">
                    {getTransactionIcon(entry.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium truncate">{entry.description}</span>
                      <span className={`text-sm font-semibold ${amountTone[entry.type]}`}>
                        {entry.type === 'EARNED' ? '+' : '-'}{entry.amount.toLocaleString()} NIP
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs opacity-70">
                      <span className="capitalize">{entry.type.toLowerCase()}</span>
                      <span>{formatTimestamp(entry.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </OtwCard>
            ))}
          </div>
        )}
      </OtwCard>

      <OtwCard>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-otwGold" />
          <h4 className="text-base font-semibold">How NIP Rewards Work</h4>
        </div>
        <p className="text-sm">
          {activeView === 'CUSTOMER'
            ? 'Earn NIP coins when your deliveries are completed. You receive 40% of the total NIP reward for each delivery.'
            : 'Earn NIP coins by accepting and completing delivery requests. You receive 60% of the total NIP reward for each delivery.'}
        </p>
        <p className="text-xs opacity-70 mt-2">1 NIP = 100 OTW miles • Rewards are distributed automatically upon completion</p>
      </OtwCard>
    </OtwPageShell>
  );
}
