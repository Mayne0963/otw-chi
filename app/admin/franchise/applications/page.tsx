import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { Button } from '@/components/ui/button';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

function statusStyles(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'DENIED':
      return 'bg-red-500/20 text-red-400 border border-red-500/30';
    default:
      return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  }
}

export default async function AdminFranchiseApplicationsPage() {
  await requireRole(['ADMIN']);

  const prisma = getPrisma();
  const applications = await prisma.franchiseApplication.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  const statusCounts = await prisma.franchiseApplication.groupBy({
    by: ['status'],
    _count: true,
  });

  const pendingCount = statusCounts.find((row) => row.status === 'PENDING')?._count ?? 0;
  const approvedCount = statusCounts.find((row) => row.status === 'APPROVED')?._count ?? 0;
  const deniedCount = statusCounts.find((row) => row.status === 'DENIED')?._count ?? 0;
  const totalCount = pendingCount + approvedCount + deniedCount;

  return (
    <OtwPageShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <OtwSectionHeader
          title="Franchise Applications"
          subtitle="Review incoming franchise applications."
        />
        <Button asChild variant="outline" size="sm">
          <a href="/api/admin/franchise-applications/export">Export CSV</a>
        </Button>
      </div>

      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{totalCount}</div>
            <div className="text-xs text-white/60">Total</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
            <div className="text-xs text-white/60">Pending</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{approvedCount}</div>
            <div className="text-xs text-white/60">Approved</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-red-400">{deniedCount}</div>
            <div className="text-xs text-white/60">Denied</div>
          </div>
        </div>
      </OtwCard>

      {applications.length === 0 ? (
        <OtwCard className="mt-3 p-8 text-center">
          <OtwEmptyState
            title="No applications yet"
            subtitle="Franchise applications will appear here once submitted."
          />
        </OtwCard>
      ) : (
        <OtwCard className="mt-3">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="opacity-60 border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-left px-4 py-3">Applicant</th>
                  <th className="text-left px-4 py-3">City / Zones</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{app.fullName}</div>
                      <div className="text-xs text-white/50">{app.email}</div>
                      {app.user?.email && app.user.email !== app.email && (
                        <div className="text-xs text-white/40">User: {app.user.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/80">{app.cityZones}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusStyles(app.status)}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/70 text-sm max-w-xs truncate" title={app.message ?? ''}>
                      {app.message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OtwCard>
      )}
    </OtwPageShell>
  );
}
