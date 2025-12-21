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
  
  const { history } = await getDriverEarnings();
  
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0,0,0,0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const weekly = history
    .filter(e => e.createdAt >= startOfWeek)
    .reduce((sum, e) => sum + e.amount, 0);
    
  const monthly = history
    .filter(e => e.createdAt >= startOfMonth)
    .reduce((sum, e) => sum + e.amount, 0);

  const prisma = getPrisma();
  const latestTicket = await prisma.supportTicket.findFirst({
    where: { userId: user.id, subject: 'Payout Request' },
    orderBy: { createdAt: 'desc' },
  });
  const latestTicketStatus = latestTicket?.status ?? null;
  const hasOpenPayoutRequest = latestTicket?.status === 'OPEN';

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
          <div className="text-sm font-medium">Actions</div>
          {latestTicketStatus && (
            <div className="mt-2 text-xs opacity-70">
              Latest payout request: <span className="font-semibold">{latestTicketStatus}</span>
            </div>
          )}
          <form action={requestPayoutAction} className="mt-2 flex gap-2">
            <input type="hidden" name="weeklyCents" value={weekly} />
            <input type="hidden" name="monthlyCents" value={monthly} />
            <OtwButton variant="outline" disabled={hasOpenPayoutRequest}>Request Payout</OtwButton>
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
                  <div>${(e.amount/100).toFixed(2)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}
