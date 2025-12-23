'use client';

import { useState, useEffect } from 'react';
import { Wallet, Clock, TrendingUp, User, Car } from 'lucide-react';

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

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '2rem'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0 0 0.5rem 0',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#6b7280',
    margin: '0'
  },
  toggleContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '2rem',
    gap: '0.5rem',
    background: '#f3f4f6',
    padding: '0.5rem',
    borderRadius: '12px',
    maxWidth: '300px',
    marginLeft: 'auto',
    marginRight: 'auto'
  },
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: 'transparent',
    color: '#6b7280'
  },
  toggleButtonActive: {
    background: 'white',
    color: '#1a1a1a',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
  },
  toggleIcon: {
    width: '16px',
    height: '16px'
  },
  walletCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '2rem',
    marginBottom: '2rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    border: '1px solid #e5e7eb'
  },
  walletHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem'
  },
  walletIcon: {
    width: '24px',
    height: '24px',
    color: '#667eea'
  },
  walletTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1a1a1a',
    margin: '0'
  },
  balanceContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem'
  },
  balance: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem'
  },
  balanceLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
    fontWeight: '500'
  },
  balanceAmount: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: '1'
  },
  balanceCurrency: {
    fontSize: '1rem',
    color: '#9ca3af',
    marginLeft: '0.25rem'
  },
  totalEarned: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem'
  },
  totalLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
    fontWeight: '500'
  },
  totalAmount: {
    fontSize: '2rem',
    fontWeight: '600',
    color: '#059669',
    lineHeight: '1'
  },
  totalCurrency: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    marginLeft: '0.25rem'
  },
  ledgerContainer: {
    background: 'white',
    borderRadius: '16px',
    padding: '2rem',
    marginBottom: '2rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    border: '1px solid #e5e7eb'
  },
  ledgerTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1a1a1a',
    margin: '0 0 1.5rem 0'
  },
  ledgerList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem'
  },
  ledgerItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    padding: '1rem',
    borderRadius: '12px',
    background: '#f9fafb',
    transition: 'background-color 0.2s ease'
  },
  transactionIconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'white',
    flexShrink: '0'
  },
  transactionIcon: {
    width: '20px',
    height: '20px',
    color: '#6b7280'
  },
  transactionDetails: {
    flex: '1',
    minWidth: '0'
  },
  transactionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '0.5rem'
  },
  transactionDescription: {
    fontSize: '0.95rem',
    fontWeight: '500',
    color: '#1a1a1a',
    flex: '1',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  transactionAmount: {
    fontSize: '0.95rem',
    fontWeight: '600',
    whiteSpace: 'nowrap' as const
  },
  transactionAmountEarned: {
    color: '#059669'
  },
  transactionAmountSpent: {
    color: '#dc2626'
  },
  transactionAmountTransferred: {
    color: '#7c3aed'
  },
  transactionFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.8rem',
    color: '#6b7280'
  },
  transactionType: {
    textTransform: 'capitalize' as const,
    fontWeight: '500'
  },
  transactionTimestamp: {
    fontSize: '0.75rem'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 2rem',
    textAlign: 'center' as const,
    color: '#6b7280'
  },
  emptyIcon: {
    width: '48px',
    height: '48px',
    marginBottom: '1rem',
    opacity: '0.5'
  },
  emptySubtext: {
    fontSize: '0.875rem',
    color: '#9ca3af'
  },
  infoBox: {
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    borderRadius: '16px',
    padding: '2rem',
    border: '1px solid #e2e8f0'
  },
  infoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  infoIcon: {
    width: '20px',
    height: '20px',
    color: '#64748b'
  },
  infoTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0'
  },
  infoContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem'
  },
  infoText: {
    fontSize: '0.95rem',
    lineHeight: '1.5',
    color: '#475569',
    margin: '0'
  },
  infoSubtext: {
    fontSize: '0.8rem',
    color: '#64748b',
    margin: '0',
    fontWeight: '500'
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    fontSize: '1.1rem',
    color: '#6b7280'
  },
  error: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    fontSize: '1.1rem',
    color: '#dc2626',
    background: '#fef2f2',
    borderRadius: '12px',
    border: '1px solid #fecaca'
  }
};

export default function NipDashboard() {
  const [activeView, setActiveView] = useState<'customer' | 'driver'>('customer');
  const [summary, setSummary] = useState<NipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);

  useEffect(() => {
    initIdsAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initIdsAndFetch = async () => {
    try {
      // Determine default IDs from live requests
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
      setError('Failed to initialize TIREM dashboard');
      console.error('Failed to initialize TIREM dashboard:', err);
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
          type: 'EARNED',
          amount: Math.abs(e.delta || 0),
          description: e.reason || 'TIREM transaction',
          timestamp: e.createdAt,
          role: 'CUSTOMER' as const,
        }));
        setSummary({
          customerWallet: data.wallet || { balance: 0, totalEarned: 0 },
          driverWallet: summary?.driverWallet || { balance: 0, totalEarned: 0 },
          recentLedger: ledger,
        });
      } else {
        setError(data.error || 'Failed to load TIREM data');
      }
    } catch (err) {
      setError('Failed to fetch customer TIREM summary');
      console.error('Failed to fetch customer TIREM summary:', err);
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
        setError('No driver available for TIREM summary');
        setLoading(false);
        return;
      }
      const response = await fetch(`/api/otw/nip/summary?driverId=${encodeURIComponent(driverId)}`);
      const data = await response.json();
      if (data.success) {
        const ledger = (data.ledger || []).map((e: any) => ({
          id: e.id,
          type: 'EARNED',
          amount: Math.abs(e.delta || 0),
          description: e.reason || 'TIREM transaction',
          timestamp: e.createdAt,
          role: 'DRIVER' as const,
        }));
        setSummary({
          customerWallet: summary?.customerWallet || { balance: 0, totalEarned: 0 },
          driverWallet: data.wallet || { balance: 0, totalEarned: 0 },
          recentLedger: ledger,
        });
      } else {
        setError(data.error || 'Failed to load TIREM data');
      }
    } catch (err) {
      setError('Failed to fetch driver TIREM summary');
      console.error('Failed to fetch driver TIREM summary:', err);
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
    switch (type) {
      case 'EARNED':
        return <TrendingUp style={styles.transactionIcon} />;
      case 'SPENT':
        return <Wallet style={styles.transactionIcon} />;
      case 'TRANSFERRED':
        return <Clock style={styles.transactionIcon} />;
      default:
        return <Wallet style={styles.transactionIcon} />;
    }
  };

  const getTransactionAmountStyle = (type: string) => {
    switch (type) {
      case 'EARNED':
        return styles.transactionAmountEarned;
      case 'SPENT':
        return styles.transactionAmountSpent;
      case 'TRANSFERRED':
        return styles.transactionAmountTransferred;
      default:
        return {};
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading TIREM Dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>No TIREM data available</div>
      </div>
    );
  }

  const currentWallet = activeView === 'customer' ? summary.customerWallet : summary.driverWallet;
  const relevantLedger = summary.recentLedger.filter(entry => entry.role === activeView.toUpperCase());

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>TIREM Dashboard</h1>
        <p style={styles.subtitle}>Your OTW Rewards & Transactions</p>
      </div>

      <div style={styles.toggleContainer}>
        <button
          style={{
            ...styles.toggleButton,
            ...(activeView === 'customer' ? styles.toggleButtonActive : {})
          }}
          onClick={() => setActiveView('customer')}
        >
          <User style={styles.toggleIcon} />
          Customer
        </button>
        <button
          style={{
            ...styles.toggleButton,
            ...(activeView === 'driver' ? styles.toggleButtonActive : {})
          }}
          onClick={async () => { setActiveView('driver'); await fetchSummaryForDriver(); }}
        >
          <Car style={styles.toggleIcon} />
          Driver
        </button>
      </div>

      <div style={styles.walletCard}>
        <div style={styles.walletHeader}>
          <Wallet style={styles.walletIcon} />
          <h2 style={styles.walletTitle}>TIREM Wallet</h2>
        </div>
        <div style={styles.balanceContainer}>
          <div style={styles.balance}>
            <span style={styles.balanceLabel}>Current Balance</span>
            <span style={styles.balanceAmount}>{currentWallet.balance.toLocaleString()}</span>
            <span style={styles.balanceCurrency}>TIREM</span>
          </div>
          <div style={styles.totalEarned}>
            <span style={styles.totalLabel}>Total Earned</span>
            <span style={styles.totalAmount}>{currentWallet.totalEarned.toLocaleString()}</span>
            <span style={styles.totalCurrency}>TIREM</span>
          </div>
        </div>
      </div>

      <div style={styles.ledgerContainer}>
        <h3 style={styles.ledgerTitle}>Recent Transactions</h3>
        <div style={styles.ledgerList}>
          {relevantLedger.length === 0 ? (
            <div style={styles.emptyState}>
              <Clock style={styles.emptyIcon} />
              <p>No transactions yet</p>
              <span style={styles.emptySubtext}>
                {activeView === 'customer' 
                  ? 'Complete deliveries to earn TIREM coins!'
                  : 'Accept and complete deliveries to earn TIREM coins!'}
              </span>
            </div>
          ) : (
            relevantLedger.map((entry) => (
              <div key={entry.id} style={styles.ledgerItem}>
                <div style={styles.transactionIconContainer}>
                  {getTransactionIcon(entry.type)}
                </div>
                <div style={styles.transactionDetails}>
                  <div style={styles.transactionHeader}>
                    <span style={styles.transactionDescription}>{entry.description}</span>
                    <span style={{...styles.transactionAmount, ...getTransactionAmountStyle(entry.type)}}>
                      {entry.type === 'EARNED' ? '+' : '-'}{entry.amount.toLocaleString()} TIREM
                    </span>
                  </div>
                  <div style={styles.transactionFooter}>
                    <span style={styles.transactionType}>{entry.type}</span>
                    <span style={styles.transactionTimestamp}>{formatTimestamp(entry.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={styles.infoBox}>
        <div style={styles.infoHeader}>
          <TrendingUp style={styles.infoIcon} />
          <h4 style={styles.infoTitle}>How TIREM Rewards Work</h4>
        </div>
        <div style={styles.infoContent}>
          <p style={styles.infoText}>
            {activeView === 'customer'
              ? 'Earn TIREM coins when your deliveries are completed. You receive 40% of the total TIREM reward for each delivery.'
              : 'Earn TIREM coins by accepting and completing delivery requests. You receive 60% of the total TIREM reward for each delivery.'}
          </p>
          <p style={styles.infoSubtext}>
            1 TIREM = 100 OTW miles • Rewards are distributed automatically upon completion
          </p>
        </div>
      </div>
    </div>
  );
}
