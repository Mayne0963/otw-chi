import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';

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
    const drivers = await prisma.driverProfile.findMany({
      include: { 
        user: { select: { id: true, name: true, email: true } }
      }
    });

    return drivers;
  } catch (error) {
    console.error('[AdminDrivers] Failed to fetch drivers:', error);
    throw error;
  }
}

async function DriversList() {
  let drivers: any[] = [];
  let error: unknown = null;

  try {
    drivers = await getDriversData();
  } catch (err) {
    error = err;
  }

  if (error) {
    return <DriversErrorState error={error} />;
  }

  if (drivers.length === 0) {
    return <EmptyDriversState />;
  }

  return <DriversTable drivers={drivers} />;
}

function EmptyDriversState() {
  return (
    <OtwCard className="mt-3 p-8 text-center">
      <div className="text-white/60">No drivers found</div>
      <div className="text-xs text-white/40 mt-2">Driver profiles will appear here when drivers register</div>
    </OtwCard>
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
              <th className="text-left px-4 py-3">Locations</th>
              <th className="text-left px-4 py-3">Earnings</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
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
                <td className="px-4 py-3 text-center">
                  <span className="text-white/70">-</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-white/70">-</span>
                </td>
                <td className="px-4 py-3 text-white/60">
                  {new Date(driver.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors">
                      View
                    </button>
                    <button className="text-xs px-2 py-1 rounded bg-otwGold/20 hover:bg-otwGold/30 text-otwGold transition-colors">
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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