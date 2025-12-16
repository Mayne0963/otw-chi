import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwStatPill from '@/components/ui/otw/OtwStatPill';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  await requireRole(['ADMIN']);
  const prisma = getPrisma();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [requestsToday, activeDrivers, openTickets] = await Promise.all([
    prisma.request.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.driverProfile.count({ where: { status: 'ONLINE' } }),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
  ]);
  const nipIssuedAgg = await prisma.nIPLedger.aggregate({
    where: { createdAt: { gte: startOfDay }, amount: { gt: 0 } },
    _sum: { amount: true },
  } as any);
  const nipIssuedToday = nipIssuedAgg._sum?.amount ?? 0;
  return (
    <OtwPageShell>
      <OtwSectionHeader title="OTW HQ — Admin" subtitle="KPIs and system overview." />
      <div className="mt-3 grid md:grid-cols-4 gap-4">
        <OtwCard>
          <div className="text-sm font-medium">Requests Today</div>
          <div className="mt-2"><OtwStatPill label="Count" value={String(requestsToday)} /></div>
        </OtwCard>
        <OtwCard>
          <div className="text-sm font-medium">Active Drivers</div>
          <div className="mt-2"><OtwStatPill label="Online" value={String(activeDrivers)} tone="success" /></div>
        </OtwCard>
        <OtwCard>
          <div className="text-sm font-medium">Open Tickets</div>
          <div className="mt-2"><OtwStatPill label="Support" value={String(openTickets)} tone="danger" /></div>
        </OtwCard>
        <OtwCard>
          <div className="text-sm font-medium">NIP Issued Today</div>
          <div className="mt-2"><OtwStatPill label="NIP" value={String(nipIssuedToday)} tone="gold" /></div>
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
