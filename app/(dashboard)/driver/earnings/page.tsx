import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth/roles';
import {
  cancelPayoutRequestAction,
  getDriverEarnings,
  getDriverPayoutRequests,
  requestPayoutAction,
} from '@/app/actions/driver';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function DriverEarningsPage() {
  const user = await getCurrentUser();
  if (!user) {
     return (
      <OtwPageShell>
        <OtwSectionHeader title="Driver Earnings" subtitle="Ledger summary and payouts." />
        <Card className="mt-3 p-5 sm:p-6"><div className="text-sm">Please sign in.</div></Card>
      </OtwPageShell>
    );
  }
  
  const [{ history, availableCents, paidOutCents, processingPayoutCents }, payoutRequests] =
    await Promise.all([getDriverEarnings(), getDriverPayoutRequests()]);
  
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0,0,0,0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const weekly = history
    .filter((e: { createdAt: Date }) => e.createdAt >= startOfWeek)
    .reduce((sum: number, e) => sum + (e.amountCents ?? 0), 0);
    
  const monthly = history
    .filter((e: { createdAt: Date }) => e.createdAt >= startOfMonth)
    .reduce((sum: number, e) => sum + (e.amountCents ?? 0), 0);

  const availableTotal = availableCents;

  const latestPayout = payoutRequests[0] ?? null;
  const latestPayoutStatus = latestPayout?.status ?? null;
  const activeProcessingPayout = payoutRequests.find((payout) => payout.status === 'processing') ?? null;
  const hasProcessingPayout = Boolean(activeProcessingPayout);

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Driver Earnings" subtitle="Ledger summary and payouts." />
      <div className="mt-3 grid md:grid-cols-3 gap-4">
        <Card className="p-5 sm:p-6">
          <div className="text-sm font-medium">Weekly</div>
          <div className="mt-2"><OtwStatPill label="USD" value={`$${(weekly/100).toFixed(2)}`} tone="success" /></div>
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="text-sm font-medium">Monthly</div>
          <div className="mt-2"><OtwStatPill label="USD" value={`$${(monthly/100).toFixed(2)}`} tone="gold" /></div>
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="text-sm font-medium">Available Balance</div>
          <div className="mt-2"><OtwStatPill label="USD" value={`$${(availableTotal/100).toFixed(2)}`} tone="neutral" /></div>
          <div className="mt-2 text-xs opacity-70">
            Paid out: <span className="font-semibold">${(paidOutCents / 100).toFixed(2)}</span>
          </div>
          <div className="mt-1 text-xs opacity-70">
            Processing: <span className="font-semibold">${(processingPayoutCents / 100).toFixed(2)}</span>
          </div>
          {latestPayoutStatus && (
            <div className="mt-2 text-xs opacity-70">
              Latest payout:{' '}
              <span className="font-semibold">
                {latestPayoutStatus.charAt(0).toUpperCase() + latestPayoutStatus.slice(1)}
              </span>
            </div>
          )}
          <form action={requestPayoutAction} className="mt-2 flex gap-2">
            <Button variant="outline" disabled={hasProcessingPayout || availableTotal <= 0}>Request Payout</Button>
          </form>
          {activeProcessingPayout && (
            <form action={cancelPayoutRequestAction} className="mt-2 flex gap-2">
              <input type="hidden" name="payoutId" value={activeProcessingPayout.id} />
              <Button variant="outline" className="w-full" type="submit">
                Cancel Current Request
              </Button>
            </form>
          )}
        </Card>
      </div>
      <Card className="mt-3 p-5 sm:p-6">
        <div className="text-sm font-medium">Payout Requests</div>
        {payoutRequests.length === 0 ? (
          <p className="mt-2 text-sm opacity-80">No payout requests yet.</p>
        ) : (
          <ul>
            {payoutRequests.map((payout) => (
              <li key={payout.id} className="py-3 border-b border-white/10 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs opacity-70">
                      {formatDistanceToNow(new Date(payout.createdAt), { addSuffix: true })}
                    </div>
                    <div className="text-xs opacity-60 mt-1">
                      {new Date(payout.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs rounded-full px-2 py-1 border font-medium ${
                        payout.status === 'paid'
                          ? 'bg-green-500/20 border-green-500/30 text-green-400'
                          : payout.status === 'failed'
                          ? 'bg-red-500/20 border-red-500/30 text-red-400'
                          : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                      }`}
                    >
                      {payout.status.toUpperCase()}
                    </span>
                    <span className="font-medium">${(payout.totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="mt-3 p-5 sm:p-6">
        <div className="text-sm font-medium">Recent Earnings</div>
        {history.length === 0 ? (
          <p className="mt-2 text-sm opacity-80">No earnings yet.</p>
        ) : (
          <ul>
            {history.slice(0, 20).map((e) => (
              <li key={e.id} className="py-2 border-b border-white/10 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="text-xs opacity-70">{new Date(e.createdAt).toLocaleDateString()}</div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs rounded-full px-2 py-1 border border-white/10 opacity-70 ${e.status === 'available' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>{e.status ?? 'pending'}</span>
                    <span>${(((e.amountCents ?? e.amount ?? 0)/100)).toFixed(2)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </OtwPageShell>
  );
}
