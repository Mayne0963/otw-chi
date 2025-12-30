import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { notFound } from 'next/navigation';

async function getDriver(id: string) {
  const prisma = getPrisma();
  const driver = await prisma.driverProfile.findUnique({
    where: { id },
    include: {
      user: true,
      zone: { select: { name: true } },
      locations: {
        orderBy: { timestamp: 'desc' },
        take: 1
      },
      _count: { select: { requests: true } }
    }
  });

  if (!driver) return null;

  const earnings = await prisma.driverEarnings.findMany({
    where: { driverId: driver.userId },
    select: { amount: true, status: true }
  });

  const totalEarnings = earnings.reduce((sum, entry) => sum + entry.amount, 0);
  const pendingEarnings = earnings
    .filter((entry) => entry.status === 'pending')
    .reduce((sum, entry) => sum + entry.amount, 0);

  return { driver, totalEarnings, pendingEarnings };
}

export default async function AdminDriverDetailPage({
  params
}: {
  params: { id: string };
}) {
  await requireRole(['ADMIN']);

  if (!params.id) {
    notFound();
  }

  const data = await getDriver(params.id);

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Driver Details"
        subtitle="Review driver profile, status, and performance."
      />

      <div className="mt-6 flex items-center gap-2">
        <Link
          href="/admin/drivers"
          className="text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Back to Drivers
        </Link>
        {data?.driver && (
          <Link
            href={`/admin/drivers/${data.driver.id}/edit`}
            className="text-xs px-3 py-2 rounded bg-otwGold/20 hover:bg-otwGold/30 text-otwGold transition-colors"
          >
            Edit Driver
          </Link>
        )}
      </div>

      <OtwCard className="mt-4 p-6">
        {!data ? (
          <OtwEmptyState
            title="Driver not found"
            subtitle="This driver profile could not be located."
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <div className="text-xl font-semibold text-white">
                {data.driver.user.name || 'Unknown Driver'}
              </div>
              <div className="text-sm text-white/60">{data.driver.user.email}</div>
              <div className="text-xs text-white/40">ID: {data.driver.id}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Status</div>
                <div className="text-sm font-medium text-white">{data.driver.status}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Zone</div>
                <div className="text-sm text-white">
                  {data.driver.zone?.name || 'Unassigned'}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Completed Requests</div>
                <div className="text-sm text-white">{data.driver._count.requests}</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Rating</div>
                <div className="text-sm text-white">
                  {data.driver.rating && data.driver.rating > 0
                    ? data.driver.rating.toFixed(1)
                    : 'No ratings'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Earnings</div>
                <div className="mt-2 text-sm text-white">
                  Total: ${(data.totalEarnings / 100).toFixed(2)}
                </div>
                {data.pendingEarnings > 0 && (
                  <div className="text-xs text-yellow-400 mt-1">
                    Pending: ${(data.pendingEarnings / 100).toFixed(2)}
                  </div>
                )}
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-xs text-white/50">Last Location</div>
                {data.driver.locations[0] ? (
                  <div className="mt-2 text-sm text-white">
                    {data.driver.locations[0].lat.toFixed(4)}, {data.driver.locations[0].lng.toFixed(4)}
                    <div className="text-xs text-white/50 mt-1">
                      {formatDistanceToNow(new Date(data.driver.locations[0].timestamp), { addSuffix: true })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-white/60">No location data</div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white/5">
              <div className="text-xs text-white/50">Joined</div>
              <div className="mt-2 text-sm text-white">
                {formatDistanceToNow(new Date(data.driver.user.createdAt), { addSuffix: true })}
              </div>
            </div>
          </div>
        )}
      </OtwCard>
    </OtwPageShell>
  );
}
