import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { getPrisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { Suspense } from 'react';

// Loading component for better UX
function AdminCitiesZonesLoading() {
  return (
    <OtwCard className="mt-3">
      <div className="animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 bg-white/5 rounded"></div>
          ))}
        </div>
      </div>
    </OtwCard>
  );
}

async function getCitiesZonesData() {
  const prisma = getPrisma();
  
  try {
    // Get all cities with their zones and counts
    const cities = await prisma.city.findMany({
      include: {
        zones: {
          include: {
            _count: {
              select: {
                drivers: true,
                requests: true
              }
            }
          }
        },
        _count: {
          select: {
            requests: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Get total counts
    const totalCities = cities.length;
    const totalZones = cities.reduce((acc, city) => acc + city.zones.length, 0);
    const totalDriversInZones = cities.reduce((acc, city) => 
      acc + city.zones.reduce((zAcc, zone) => zAcc + zone._count.drivers, 0), 0
    );
    const totalRequestsInCities = cities.reduce((acc, city) => acc + city._count.requests, 0);

    return { cities, totalCities, totalZones, totalDriversInZones, totalRequestsInCities };
  } catch (error) {
    console.error('[AdminCitiesZones] Failed to fetch cities and zones:', error);
    throw error;
  }
}

async function CitiesZonesList() {
  let cities: any[] = [];
  let totalCities = 0;
  let totalZones = 0;
  let totalDriversInZones = 0;
  let totalRequestsInCities = 0;
  let error: unknown = null;

  try {
    const data = await getCitiesZonesData();
    cities = data.cities;
    totalCities = data.totalCities;
    totalZones = data.totalZones;
    totalDriversInZones = data.totalDriversInZones;
    totalRequestsInCities = data.totalRequestsInCities;
  } catch (err) {
    error = err;
  }

  if (error) {
    return <CitiesZonesErrorState error={error} />;
  }

  return (
    <>
      <OtwCard className="mt-3 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-otwGold">{totalCities}</div>
            <div className="text-xs text-white/60">Active Cities</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">{totalZones}</div>
            <div className="text-xs text-white/60">Total Zones</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{totalDriversInZones}</div>
            <div className="text-xs text-white/60">Drivers in Zones</div>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-white">{totalRequestsInCities}</div>
            <div className="text-xs text-white/60">Total Requests</div>
          </div>
        </div>
      </OtwCard>

      {cities.length === 0 ? (
        <OtwCard className="mt-3 p-8 text-center">
          <OtwEmptyState 
            title="No cities configured" 
            subtitle="Add cities and zones to define your service coverage areas." 
          />
        </OtwCard>
      ) : (
        <CitiesZonesContent cities={cities} />
      )}
    </>
  );
}

function CitiesZonesContent({ cities }: { cities: any[] }) {
  return (
    <div className="mt-3 space-y-4">
      {cities.map((city) => (
        <OtwCard key={city.id} className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{city.name}</h3>
              <p className="text-xs text-white/50">
                {city.zones.length} zone{city.zones.length !== 1 ? 's' : ''} • {city._count.requests} request{city._count.requests !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors">
                Edit City
              </button>
              <button className="text-xs px-3 py-1 rounded bg-otwGold/20 hover:bg-otwGold/30 text-otwGold transition-colors">
                Add Zone
              </button>
            </div>
          </div>
          
          {city.zones.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="opacity-60 border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-2">Zone Name</th>
                    <th className="text-left px-4 py-2">Drivers</th>
                    <th className="text-left px-4 py-2">Requests</th>
                    <th className="text-left px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {city.zones.map((zone: any) => (
                    <tr key={zone.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2 font-medium">{zone.name}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          zone._count.drivers > 0
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}>
                          {zone._count.drivers} driver{zone._count.drivers !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-white/70">{zone._count.requests}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <button className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors">
                            Edit
                          </button>
                          <button className="text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-white/50 text-sm">
              No zones configured for this city
            </div>
          )}
        </OtwCard>
      ))}
    </div>
  );
}

function CitiesZonesErrorState({ error }: { error: unknown }) {
  return (
    <OtwCard className="mt-3 p-8 text-center border-red-500/30 bg-red-500/10">
      <div className="text-red-400">Failed to load cities and zones</div>
      <div className="text-xs text-white/40 mt-2">
        {error instanceof Error ? error.message : 'Unknown error occurred'}
      </div>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-4 text-xs px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
      >
        Retry
      </button>
    </OtwCard>
  );
}

export default async function AdminCitiesZonesPage() {
  await requireRole(['ADMIN']);
  
  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Cities & Zones Management" 
        subtitle="Manage service coverage areas and zone assignments." 
      />
      
      <div className="mt-6">
        <Suspense fallback={<AdminCitiesZonesLoading />}>
          <CitiesZonesList />
        </Suspense>
      </div>
    </OtwPageShell>
  );
}
