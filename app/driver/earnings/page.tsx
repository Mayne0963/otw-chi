import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

export default async function DriverEarningsPage() {
  const prisma = getPrisma();
  const user = await getCurrentUser();
  let weekly = 0;
  let monthly = 0;
  let recent: Array<{ id: string; pickup: string; dropoff: string; costEstimate: number; completedAt: string }> = [];
  let latestTicketStatus: string | null = null;
  let hasOpenPayoutRequest = false;
  if (user) {
    const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
    if (driver) {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0,0,0,0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const completed = await prisma.request.findMany({
        where: { assignedDriverId: driver.id, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      const earningPct = 0.7;
      recent = completed.map(r => ({
        id: r.id,
        pickup: r.pickup,
        dropoff: r.dropoff,
        costEstimate: Math.round(Number(r.costEstimate || 0)),
        completedAt: r.createdAt.toISOString(),
      }));
      weekly = completed
        .filter(r => r.createdAt >= startOfWeek)
        .reduce((sum, r) => sum + Math.round(Number(r.costEstimate || 0) * earningPct), 0);
      monthly = completed
        .filter(r => r.createdAt >= startOfMonth)
        .reduce((sum, r) => sum + Math.round(Number(r.costEstimate || 0) * earningPct), 0);
      const latestTicket = await prisma.supportTicket.findFirst({
        where: { userId: user.id, subject: 'Payout Request' },
        orderBy: { createdAt: 'desc' },
      });
      latestTicketStatus = latestTicket?.status ?? null;
      hasOpenPayoutRequest = latestTicket?.status === 'OPEN';
    }
  }
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
            <input type="hidden" name="recentIds" value={recent.map(r => r.id).join(',')} />
            <OtwButton variant="outline" disabled={hasOpenPayoutRequest}>Request Payout</OtwButton>
          </form>
        </OtwCard>
      </div>
      <OtwCard className="mt-3">
        <div className="text-sm font-medium">Recent Completed Jobs</div>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm opacity-80">No completed jobs yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm opacity-90">
            {recent.map(r => (
              <li key={r.id}>
                <div className="flex items-center justify-between">
                  <div>{r.pickup} → {r.dropoff}</div>
                  <div>${(r.costEstimate/100).toFixed(2)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}

export async function requestPayoutAction(formData: FormData) {
  'use server';
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();
  if (!userId) return;
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({ where: { clerkId: userId } });
  if (!user) return;
  const existingOpen = await prisma.supportTicket.findFirst({
    where: { userId: user.id, subject: 'Payout Request', status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  });
  if (existingOpen) return;
  const weeklyCents = Number(formData.get('weeklyCents') ?? 0);
  const monthlyCents = Number(formData.get('monthlyCents') ?? 0);
  const recentIds = String(formData.get('recentIds') ?? '');
  const subject = 'Payout Request';
  const message = `Driver payout request\nWeekly: $${(weeklyCents/100).toFixed(2)}\nMonthly: $${(monthlyCents/100).toFixed(2)}\nRecent jobs: ${recentIds}`;
  await prisma.supportTicket.create({
    data: {
      userId: user.id,
      subject,
      status: 'OPEN',
      message,
    },
  });
}
