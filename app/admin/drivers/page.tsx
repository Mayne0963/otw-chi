import AdminDriversLiveMap from '@/components/admin/AdminDriversLiveMap';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';
import { DeliveryRequestStatus } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';

// Loading component for better UX
function AdminDriversLoading() {
  return (
    <OtwCard className="mt-3">
      <div className="animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-12 bg-white/5 rounded"></div>
          ))}
        </div>
      </div>
    </OtwCard>
  );
}

async function getDriversData() {
  const prisma = getPrisma();
  
  try {
    // Get all drivers with their user info, zone, and locations
    const drivers = await prisma.driverProfile.findMany({
      include: { 
        user: { 
          select: { 
            id: true, 
            name: true, 
            email: true
          } 
        },
        zone: { select: { name: true } },
        telemetry: {
          orderBy: { recordedAt: 'desc' },
          take: 1
        },
        locationPings: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        locations: {
          orderBy: { timestamp: 'desc' },
          take: 1
        },
        assignedDeliveryRequests: {
          where: { status: 'DELIVERED' }
        }
      }
    });

    // Fetch earnings separately for all drivers using user IDs
    const userIds = drivers.map(d => d.userId);
    const earnings = await prisma.driverEarnings.findMany({
      where: {
        driverId: { in: userIds }
      },
      select: {
        driverId: true,
        amount: true,
        status: true
      }
    });

    // Map earnings to drivers
    const driversWithEarnings = drivers.map(driver => ({
      ...driver,
      earnings: earnings.filter(e => e.driverId === driver.userId)
    }));

    // Calculate statistics
    const totalDrivers = drivers.length;
    const onlineDrivers = drivers.filter(d => d.status === 'ONLINE').length;
    const busyDrivers = drivers.filter(d => d.status === 'BUSY').length;
    const offlineDrivers = drivers.filter(d => d.status === 'OFFLINE').length;

    // Calculate total earnings from the earnings array
    const totalEarnings = earnings.reduce((acc, e) => acc + e.amount, 0);

    return { drivers: driversWithEarnings, totalDrivers, onlineDrivers, busyDrivers, offlineDrivers, totalEarnings };
  } catch (error) {
    console.error('[AdminDrivers] Failed to fetch drivers:', error);
    throw error;
  }
}

type DriversData = Awaited<ReturnType<typeof getDriversData>>;
type DriverRow = DriversData['drivers'][number];

async function DriversList() {
  let drivers: DriverRow[] = [];
  let totalDrivers = 0;
  let onlineDrivers = 0;
  let busyDrivers = 0;
  let offlineDrivers = 0;
  let totalEarnings = 0;
  let error: unknown = null;

  try {
    const data = await getDriversData();
    drivers = data.drivers;
    totalDrivers = data.totalDrivers;
    onlineDrivers = data.onlineDrivers;
    busyDrivers = data.busyDrivers;
    offlineDrivers = data.offlineDrivers;
    totalEarnings = data.totalEarnings;
  } catch (err) {
    error = err;
  }

  if (error) {
    return <DriversErrorState error={error} />;
  }

  return (
    <>
      <AdminDriversLiveMap />

      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{totalDrivers}</div>
            <div className="text-xs text-white/60">Total Drivers</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{onlineDrivers}</div>
            <div className="text-xs text-white/60">Online</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{busyDrivers}</div>
            <div className="text-xs text-white/60">Busy</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-gray-400">{offlineDrivers}</div>
            <div className="text-xs text-white/60">Offline</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-otwGold">${(totalEarnings / 100).toFixed(2)}</div>
            <div className="text-xs text-white/60">Total Earnings</div>
          </div>
        </div>
      </OtwCard>

      {drivers.length === 0 ? (
        <OtwCard className="mt-3 p-8 text-center">
          <OtwEmptyState 
            title="No drivers found" 
            subtitle="Driver profiles will appear here when drivers register." 
          />
        </OtwCard>
      ) : (
        <DriversTable drivers={drivers} />
      )}
    </>
  );
}

function DriversTable({ drivers }: { drivers: any[] }) {
  return (
    <OtwCard className="mt-3">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="opacity-60 border-b border-white/10">
            <tr>
              <th className="text-left px-4 py-3">Driver</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Zone</th>
              <th className="text-left px-4 py-3">Last Location</th>
              <th className="text-left px-4 py-3">Completed</th>
              <th className="text-left px-4 py-3">Earnings</th>
              <th className="text-left px-4 py-3">Rating</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => {
              // Calculate driver's total earnings
              const driverEarnings = driver.earnings?.reduce((sum: number, e: any) => sum + e.amount, 0) || 0;
              const pendingEarnings = driver.earnings
                ?.filter((e: any) => e.status === 'pending')
                .reduce((sum: number, e: any) => sum + e.amount, 0) || 0;
              
              // Get last known location
              const telemetry = driver.telemetry?.[0] ?? null;
              const ping = driver.locationPings?.[0] ?? null;
              const legacyLocation = driver.locations?.[0] ?? null;
              const lastLocation = telemetry
                ? { lat: telemetry.lat, lng: telemetry.lng, at: telemetry.recordedAt }
                : ping
                  ? { lat: ping.lat, lng: ping.lng, at: ping.createdAt }
                  : legacyLocation
                    ? { lat: legacyLocation.lat, lng: legacyLocation.lng, at: legacyLocation.timestamp }
                    : null;
              
              return (
                <tr key={driver.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{driver.user.name || 'Unknown Driver'}</div>
                      <div className="text-xs text-white/50">{driver.user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      driver.status === 'ONLINE' 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : driver.status === 'BUSY'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {driver.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {driver.zone?.name || <span className="text-white/40">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    {lastLocation ? (
                      <div className="text-xs">
                        <div className="text-white/70">
                          {lastLocation.lat.toFixed(4)}, {lastLocation.lng.toFixed(4)}
                        </div>
                        <div className="text-white/40">
                          {formatDistanceToNow(new Date(lastLocation.at), { addSuffix: true })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-white/40 text-xs">No location data</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-white/70">{driver.assignedDeliveryRequests.length}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      <div className="font-medium text-otwGold">${(driverEarnings / 100).toFixed(2)}</div>
                      {pendingEarnings > 0 && (
                        <div className="text-yellow-400">${(pendingEarnings / 100).toFixed(2)} pending</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {driver.rating && driver.rating > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span className="text-white/70">{driver.rating.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="text-white/40 text-xs">No ratings</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {driver.user.createdAt ? formatDistanceToNow(new Date(driver.user.createdAt), { addSuffix: true }) : 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <OtwButton
                        as="a"
                        href={`/admin/drivers/${driver.id}?id=${driver.id}`}
                        variant="ghost"
                        className="text-xs px-2 py-1"
                      >
                        View
                      </OtwButton>
                      <OtwButton
                        as="a"
                        href={`/admin/drivers/${driver.id}/edit?id=${driver.id}`}
                        variant="gold"
                        className="text-xs px-2 py-1"
                      >
                        Edit
                      </OtwButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </OtwCard>
  );
}

function DriversErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load drivers</div>
      <div className="text-xs text-white/40 mt-2">
        {error instanceof Error ? error.message : 'Unknown error occurred'}
      </div>
      <OtwButton 
        onClick={() => window.location.reload()} 
        className="mt-4 text-xs px-3 py-2"
        variant="ghost"
      >
        Retry
      </OtwButton>
    </OtwCard>
  );
}

export default async function AdminDriversPage() {
  await requireRole(['ADMIN']);
  
  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Driver Management" 
        subtitle="Manage driver profiles, status, and performance." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminDriversLoading />}>
          <DriversList />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}
