import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DriverLiveMap from '@/components/otw/DriverLiveMap';
import { validateAddress } from '@/lib/geocoding';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { RequestStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import type { OtwLocation } from '@/lib/otw/otwTypes';
import type { OtwDriverLocation } from '@/lib/otw/otwDriverLocation';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { haversineDistanceKm } from '@/lib/otw/otwGeo';
import { acceptDeliveryRequest, completeDeliveryRequest, markDriverArrived } from '@/lib/driver-lifecycle';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DriverDashboardPage() {
  noStore();
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }
  if (user.role !== 'DRIVER' && user.role !== 'ADMIN') {
    redirect('/');
  }
  const prisma = getPrisma();

  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: user!.id },
  });

  if (!driverProfile) {
    return (
        <OtwPageShell>
            <OtwSectionHeader title="Driver Dashboard" subtitle="Access denied." />
            <Card className="mt-4 p-5 sm:p-6">
                <div className="p-8 text-center text-xl text-red-400">Driver profile not found. Please contact support.</div>
            </Card>
        </OtwPageShell>
    );
  }

  const driverId = driverProfile.id;

  const assignedRequests = await prisma.deliveryRequest.findMany({
    where: { 
        assignedDriverId: driverId,
        status: { in: ['ASSIGNED', 'PICKED_UP', 'EN_ROUTE'] }
    },
    orderBy: { createdAt: 'desc' }
  });

  const availableRequests = await prisma.deliveryRequest.findMany({
    where: { 
        status: 'REQUESTED',
        assignedDriverId: null 
    },
    orderBy: { createdAt: 'desc' }
  });

  const assignedLegacyRequests = await prisma.request.findMany({
    where: {
      assignedDriverId: driverProfile.id,
      status: { in: [RequestStatus.ASSIGNED, RequestStatus.PICKED_UP] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const availableLegacyRequests = await prisma.request.findMany({
    where: {
      status: RequestStatus.SUBMITTED,
      assignedDriverId: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeRequest = assignedRequests[0] ?? null;
  let customerLocation: OtwLocation | undefined;
  let pickupLocation: OtwLocation | undefined;
  let dropoffLocation: OtwLocation | undefined;
  let driverLocations: OtwDriverLocation[] = [];

  if (activeRequest) {
    const [pickup, dropoff] = await Promise.all([
      validateAddress(activeRequest.pickupAddress).catch(() => null),
      validateAddress(activeRequest.dropoffAddress).catch(() => null),
    ]);

    if (pickup) {
      pickupLocation = {
        lat: pickup.latitude,
        lng: pickup.longitude,
        label: 'Pickup',
      };
    }

    if (dropoff) {
      dropoffLocation = {
        lat: dropoff.latitude,
        lng: dropoff.longitude,
        label: 'Dropoff',
      };

      customerLocation = {
        lat: dropoff.latitude,
        lng: dropoff.longitude,
        label: 'Customer',
      };
    }

    if (
      typeof activeRequest.lastKnownLat === 'number' &&
      typeof activeRequest.lastKnownLng === 'number'
    ) {
      const lastSeen =
        activeRequest.lastKnownAt instanceof Date
          ? activeRequest.lastKnownAt.toISOString()
          : new Date().toISOString();

      driverLocations = [
        {
          driverId: driverProfile.id,
          location: {
            lat: activeRequest.lastKnownLat,
            lng: activeRequest.lastKnownLng,
            label: 'You',
          },
          updatedAt: lastSeen,
          currentRequestId: activeRequest.id,
        },
      ];
    }
  }

  async function acceptRequest(formData: FormData) {
    'use server';
    const requestId = formData.get('requestId') as string;

    if (!requestId) return;

    await acceptDeliveryRequest(requestId, driverId);

    revalidatePath('/driver/dashboard');
  }

  async function acceptLegacyRequest(formData: FormData) {
    'use server';
    const requestId = formData.get('requestId') as string;
    const driverId = formData.get('driverId') as string;

    if (!requestId || !driverId) return;

    const prisma = getPrisma();
    const req = await prisma.request.findUnique({ where: { id: requestId } });
    if (req?.status !== RequestStatus.SUBMITTED) return;

    await prisma.$transaction([
      prisma.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.ASSIGNED,
          assignedDriverId: driverId,
        },
      }),
      prisma.driverAssignment.create({
        data: {
          requestId,
          driverId,
        },
      }),
    ]);

    revalidatePath('/driver/dashboard');
  }

  async function updateStatus(formData: FormData) {
    'use server';
    const requestId = formData.get('requestId') as string;
    const newStatus = formData.get('status') as 'PICKED_UP' | 'EN_ROUTE' | 'DELIVERED';
    
    if (!requestId || !newStatus) return;

    const prisma = getPrisma();
    const existing = await prisma.deliveryRequest.findUnique({ where: { id: requestId } });
    if (!existing) return;

    const hasCoords =
      typeof existing.lastKnownLat === 'number' &&
      typeof existing.lastKnownLng === 'number';

    if (newStatus === 'PICKED_UP') {
      if (existing.status !== 'ASSIGNED') return;

      if (!hasCoords) return;

      const pickupLocation = await validateAddress(existing.pickupAddress).catch(() => null);
      if (!pickupLocation) return;

      const distanceKm = haversineDistanceKm(
        {
          lat: existing.lastKnownLat as number,
          lng: existing.lastKnownLng as number,
          label: 'Driver',
        },
        {
          lat: pickupLocation.latitude,
          lng: pickupLocation.longitude,
          label: 'Pickup',
        }
      );

      if (distanceKm > 0.1524) return;

      await markDriverArrived(requestId, driverId);
      revalidatePath('/driver/dashboard');
      return;
    }

    if (newStatus === 'EN_ROUTE') {
      if (existing.status !== 'PICKED_UP') return;
    }

    if (newStatus === 'DELIVERED') {
      if (existing.status !== 'EN_ROUTE' && existing.status !== 'PICKED_UP') return;

      await completeDeliveryRequest(requestId, driverId);
      revalidatePath('/driver/dashboard');
      return;
    }

    await prisma.deliveryRequest.update({
      where: { id: requestId },
      data: { status: newStatus },
    });
    
    revalidatePath('/driver/dashboard');
  }

  async function updateLegacyStatus(formData: FormData) {
    'use server';
    const requestId = formData.get('requestId') as string;
    const newStatus = formData.get('status') as 'PICKED_UP' | 'DELIVERED';

    if (!requestId || !newStatus) return;

    const prisma = getPrisma();
    const job = await prisma.request.findUnique({ where: { id: requestId } });
    if (!job) return;

    if (newStatus === 'PICKED_UP') {
      if (job.status !== RequestStatus.ASSIGNED) return;

      const hasCoords =
        typeof job.lastKnownLat === 'number' && typeof job.lastKnownLng === 'number';
      if (!hasCoords) return;

      const pickupLocation = await validateAddress(job.pickup).catch(() => null);
      if (!pickupLocation) return;

      const distanceKm = haversineDistanceKm(
        {
          lat: job.lastKnownLat as number,
          lng: job.lastKnownLng as number,
          label: 'Driver',
        },
        {
          lat: pickupLocation.latitude,
          lng: pickupLocation.longitude,
          label: 'Pickup',
        }
      );

      if (distanceKm > 0.1524) return;

      await prisma.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.PICKED_UP },
      });
    }

    if (newStatus === 'DELIVERED') {
      if (job.status !== RequestStatus.PICKED_UP) return;

      await prisma.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.DELIVERED },
      });
    }

    revalidatePath('/driver/dashboard');
  }

  return (
      <OtwPageShell>
        <OtwSectionHeader title="Driver Dashboard" subtitle="Manage your route and assignments." />

        <section className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-white">Live Map</h2>
            <Card className="p-5 sm:p-6">
                <div className="p-4 border-b border-white/10">
                    <h3 className="text-lg font-medium text-white">
                      {activeRequest ? 'Active Route Overview' : 'No active route'}
                    </h3>
                </div>
                <div className="p-0 min-h-[520px]">
                    {activeRequest ? (
                      <DriverLiveMap
                          key={activeRequest.id}
                          driverId={driverProfile.id}
                          customer={customerLocation}
                          pickup={pickupLocation}
                          dropoff={dropoffLocation}
                          requestId={activeRequest.id}
                          requestType="delivery"
                          jobStatus={activeRequest.status}
                          initialDriverLocation={driverLocations[0] ?? null}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center bg-white/5 text-sm text-white/50">
                        No active delivery assigned. Accept a request to start navigation.
                      </div>
                    )}
                </div>
            </Card>
        </section>
        
        {/* Active Jobs */}
        <section className="mt-8">
            <h2 className="text-xl font-semibold mb-4 text-white">My Active Jobs</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...assignedRequests, ...assignedLegacyRequests.map(r => ({ ...r, isLegacy: true }))].map((req: any) => (
                    <Card key={req.id} className="border-otwGold/30 bg-otwGold/10 p-5 sm:p-6">
                        <div className="p-4 border-b border-otwGold/20 flex justify-between items-center">
                            <span className="font-medium text-otwGold">{req.serviceType}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${req.isLegacy ? "bg-white/10 text-white/70" : "bg-otwGold text-black"}`}>
                                {req.status.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="p-4">
                            <div className="space-y-4 text-sm mb-6">
                                <div className="grid grid-cols-[min-content_1fr] gap-x-3 gap-y-1">
                                    <div className="flex flex-col items-center pt-1">
                                        <div className="h-2 w-2 rounded-full bg-otwGold" />
                                        <div className="w-0.5 grow bg-white/10 my-0.5" />
                                    </div>
                                    <div>
                                        <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Pickup</span>
                                        <p className="text-base leading-snug text-white">{req.pickupAddress || req.pickup}</p>
                                    </div>
                                    
                                    <div className="flex flex-col items-center pb-1">
                                        <div className="h-2 w-2 rounded-full bg-white/50" />
                                    </div>
                                    <div>
                                        <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Dropoff</span>
                                        <p className="text-base leading-snug text-white">{req.dropoffAddress || req.dropoff}</p>
                                    </div>
                                </div>

                                {req.notes && (
                                     <div className="bg-black/20 p-3 rounded-lg text-sm italic text-white/70 border border-white/5">
                                         &quot;{req.notes}&quot;
                                     </div>
                                 )}
                            </div>

                            <div className="flex gap-2">
                                {(req.status === 'ASSIGNED' || req.status === RequestStatus.ASSIGNED) && (
                                    <form action={req.isLegacy ? updateLegacyStatus : updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value="PICKED_UP" />
                                        <Button type="submit" className="w-full" variant="gold">
                                            Confirm Pickup
                                        </Button>
                                    </form>
                                )}
                                
                                {(req.status === 'PICKED_UP' || req.status === RequestStatus.PICKED_UP) && (
                                    <form action={req.isLegacy ? updateLegacyStatus : updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value="DELIVERED" />
                                        <Button type="submit" className="w-full" variant="gold">
                                            Complete Delivery
                                        </Button>
                                    </form>
                                )}
                                
                                {req.status === 'EN_ROUTE' && (
                                    <form action={updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value="DELIVERED" />
                                        <Button type="submit" className="w-full" variant="gold">
                                            Complete Delivery
                                        </Button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
                
                {[...assignedRequests, ...assignedLegacyRequests].length === 0 && (
                    <div className="col-span-full">
                        <OtwEmptyState
                            title="No Active Jobs"
                            subtitle="You don't have any assigned jobs at the moment."
                        />
                    </div>
                )}
            </div>
        </section>

        {/* Available Requests */}
        <section className="mt-8">
            <h2 className="text-xl font-semibold mb-4 text-white">Available Requests</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...availableRequests, ...availableLegacyRequests.map(r => ({ ...r, isLegacy: true }))].map((req: any) => (
                    <Card key={req.id} className="p-5 sm:p-6">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <span className="font-medium text-white">{req.serviceType}</span>
                            <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-medium uppercase">New</span>
                        </div>
                        <div className="p-4">
                            <div className="space-y-4 text-sm mb-6">
                                <div>
                                    <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Pickup</span>
                                    <p className="text-base leading-snug text-white truncate">{req.pickupAddress || req.pickup}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Dropoff</span>
                                    <p className="text-base leading-snug text-white truncate">{req.dropoffAddress || req.dropoff}</p>
                                </div>
                                <div className="flex gap-4 pt-2">
                                     <div>
                                         <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Distance</span>
                                         <p className="text-lg font-bold text-white">{req.distance || '0'} mi</p>
                                     </div>
                                     <div>
                                         <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Est. Payout</span>
                                         <p className="text-lg font-bold text-otwGold">${req.price || '0.00'}</p>
                                     </div>
                                </div>
                            </div>
                            
                            <form action={req.isLegacy ? acceptLegacyRequest : acceptRequest}>
                                <input type="hidden" name="requestId" value={req.id} />
                                <input type="hidden" name="driverId" value={driverProfile.id} />
                                <Button type="submit" className="w-full" variant="outline">
                                    Accept Job
                                </Button>
                            </form>
                        </div>
                    </Card>
                ))}

                {[...availableRequests, ...availableLegacyRequests].length === 0 && (
                     <div className="col-span-full">
                         <OtwEmptyState
                             title="No Available Requests"
                             subtitle="Check back later for new delivery opportunities."
                         />
                     </div>
                 )}
            </div>
        </section>
      </OtwPageShell>
  );
}
