import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';
import { getDriverEarnings, requestPayoutAction } from '@/app/actions/driver';

export const dynamic = 'force-dynamic';

export default async function DriverEarningsPage() {
  const user = await getCurrentUser();
  if (!user) {
     return (
      <OtwPageShell>
        <OtwSectionHeader title="Driver Earnings" subtitle="Ledger summary and payouts." />
        <OtwCard className="mt-3"><div className="text-sm">Please sign in.</div></OtwCard>
      </OtwPageShell>
    );
  }
  
  const { history, total } = await getDriverEarnings();
  
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0,0,0,0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const weekly = history
    .filter(e => e.createdAt >= startOfWeek)
    .reduce((sum, e) => sum + (((e as any).amountCents ?? e.amount ?? 0)), 0);
    
  const monthly = history
    .filter(e => e.createdAt >= startOfMonth)
    .reduce((sum, e) => sum + (((e as any).amountCents ?? e.amount ?? 0)), 0);

  const availableTotal = history
    .filter(e => (e as any).status === 'available')
    .reduce((sum, e) => sum + (((e as any).amountCents ?? e.amount ?? 0)), 0);

  const prisma = getPrisma();
  const p: any = prisma as any;
  const latestPayout = await p.driverPayout?.findFirst?.({
    where: { driverId: user.id },
    orderBy: { createdAt: 'desc' },
  }) ?? null;
  const latestPayoutStatus = (latestPayout as any)?.status ?? null;
  const hasProcessingPayout = (latestPayout as any)?.status === 'processing';

  return (
    <OtwPageShell>
      <OtwSectionHeader title="Driver Earnings" subtitle="Ledger summary and payouts." />
      <div className="mt-3 grid md:grid-cols-3 gap-4">
        <OtwCard>
          <div className="text-sm font-medium">Weekly</div>
          <div className="mt-2"><OtwStatPill label="USD" value={`$${(weekly/100).toFixed(2)}`} tone="success" /></div>
        </OtwCard>
        <OtwCard>
          <div className="text-sm font-medium">Monthly</div>
          <div className="mt-2"><OtwStatPill label="USD" value={`$${(monthly/100).toFixed(2)}`} tone="gold" /></div>
        </OtwCard>
        <OtwCard>
          <div className="text-sm font-medium">Available Balance</div>
          <div className="mt-2"><OtwStatPill label="USD" value={`$${(availableTotal/100).toFixed(2)}`} tone="neutral" /></div>
          {latestPayoutStatus && (
            <div className="mt-2 text-xs opacity-70">
              Latest payout: <span className="font-semibold">{latestPayoutStatus}</span>
            </div>
          )}
          <form action={requestPayoutAction} className="mt-2 flex gap-2">
            <input type="hidden" name="availableCents" value={availableTotal} />
            <OtwButton variant="outline" disabled={hasProcessingPayout || availableTotal <= 0}>Request Payout</OtwButton>
          </form>
        </OtwCard>
      </div>
      <OtwCard className="mt-3">
        <div className="text-sm font-medium">Recent Earnings</div>
        {history.length === 0 ? (
          <p className="mt-2 text-sm opacity-80">No earnings yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm opacity-90">
            {history.slice(0, 20).map(e => (
              <li key={e.id} className="py-2 border-b border-white/10 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="text-xs opacity-70">Job {e.requestId?.slice(-6) ?? 'N/A'}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs rounded-full px-2 py-1 border border-white/10 opacity-70">{(e as any).status ?? 'pending'}</span>
                    <span>${((((e as any).amountCents ?? e.amount ?? 0)/100)).toFixed(2)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}
