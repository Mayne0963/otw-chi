import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DriverLiveMap from '@/components/otw/DriverLiveMap';
import { validateAddress } from '@/lib/geocoding';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { RequestStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import type { OtwLocation } from '@/lib/otw/otwTypes';
import type { OtwDriverLocation } from '@/lib/otw/otwDriverLocation';

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
    return <div className="p-8 text-center text-xl text-red-500">Driver profile not found. Please contact support.</div>;
  }

  const assignedRequests = await prisma.deliveryRequest.findMany({
    where: { 
        assignedDriverId: driverProfile.id,
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
    const driverId = formData.get('driverId') as string;
    
    if (!requestId || !driverId) return;
    
    const prisma = getPrisma();
    
    // Optimistic check
    const req = await prisma.deliveryRequest.findUnique({ where: { id: requestId } });
    if (req?.status !== 'REQUESTED') return;
    
    await prisma.$transaction([
        prisma.deliveryRequest.update({
            where: { id: requestId },
            data: { 
                status: 'ASSIGNED',
                assignedDriverId: driverId 
            }
        }),
        prisma.driverAssignment.create({
            data: {
                deliveryRequestId: requestId,
                driverId
            }
        })
    ]);
    
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
    await prisma.deliveryRequest.update({
        where: { id: requestId },
        data: { status: newStatus } 
    });
    
    revalidatePath('/driver/dashboard');
  }

  async function updateLegacyStatus(formData: FormData) {
    'use server';
    const requestId = formData.get('requestId') as string;
    const newStatus = formData.get('status') as 'PICKED_UP' | 'DELIVERED';

    if (!requestId || !newStatus) return;

    const prisma = getPrisma();
    await prisma.request.update({
      where: { id: requestId },
      data: { status: newStatus },
    });

    revalidatePath('/driver/dashboard');
  }

  return (
      <div className="otw-container otw-section space-y-8">
        <h1 className="text-3xl font-semibold text-foreground">Driver Dashboard</h1>

        <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Live Map</h2>
            <Card className="text-foreground">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">
                      {activeRequest ? 'Active Route Overview' : 'No active route'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
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
                      <div className="rounded-lg border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                        No active delivery assigned. Accept a request to start navigation.
                      </div>
                    )}
                </CardContent>
            </Card>
        </section>
        
        {/* Active Jobs */}
        <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">My Active Jobs</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...assignedRequests, ...assignedLegacyRequests.map(r => ({ ...r, isLegacy: true }))].map((req: any) => (
                    <Card key={req.id} className="text-foreground border-otwGold/20 bg-otwGold/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>{req.serviceType}</span>
                                <Badge variant={req.isLegacy ? "secondary" : "default"} className={req.isLegacy ? "opacity-70" : "bg-otwGold text-black"}>
                                    {req.status.replace('_', ' ')}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 text-sm mb-6">
                                <div className="grid grid-cols-[min-content_1fr] gap-x-3 gap-y-1">
                                    <div className="flex flex-col items-center pt-1">
                                        <div className="h-2 w-2 rounded-full bg-otwGold" />
                                        <div className="w-0.5 grow bg-white/10 my-0.5" />
                                    </div>
                                    <div>
                                        <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Pickup</span>
                                        <p className="text-base leading-snug">{req.pickupAddress || req.pickup}</p>
                                    </div>
                                    
                                    <div className="flex flex-col items-center pb-1">
                                        <div className="h-2 w-2 rounded-full bg-white/50" />
                                    </div>
                                    <div>
                                        <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Dropoff</span>
                                        <p className="text-base leading-snug">{req.dropoffAddress || req.dropoff}</p>
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
                                        <Button type="submit" size="lg" className="w-full bg-otwGold text-black hover:bg-otwGold/90 font-semibold text-base h-12">
                                            Confirm Pickup
                                        </Button>
                                    </form>
                                )}
                                {(req.status === 'PICKED_UP' || req.status === RequestStatus.PICKED_UP) && (
                                    <form action={req.isLegacy ? updateLegacyStatus : updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name={req.isLegacy ? "status" : "status"} value={req.isLegacy ? RequestStatus.DELIVERED : "EN_ROUTE"} />
                                        <Button type="submit" size="lg" className="w-full bg-otwGold text-black hover:bg-otwGold/90 font-semibold text-base h-12">
                                            {req.isLegacy ? "Complete Delivery" : "Start Delivery"}
                                        </Button>
                                    </form>
                                )}
                                {req.status === 'EN_ROUTE' && (
                                    <form action={updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value="DELIVERED" />   
                                        <Button type="submit" size="lg" className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold text-base h-12">
                                            Complete Delivery
                                        </Button>
                                    </form>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {assignedRequests.length === 0 && assignedLegacyRequests.length === 0 && (
                    <p className="text-muted-foreground col-span-full py-12 text-center border border-dashed border-border/40 bg-card/20 rounded-xl">
                        No active jobs. Check available jobs below.
                    </p>
                )}
            </div>
        </section>

        {/* Available Jobs */}
        <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Available Jobs</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...availableRequests, ...availableLegacyRequests.map(r => ({ ...r, isLegacy: true }))].map((req: any) => (
                    <Card key={req.id} className="text-foreground hover:bg-white/5 transition-colors">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>{req.serviceType}</span>
                                <Badge variant="outline" className="text-xs font-normal opacity-70">
                                    {req.isLegacy ? 'LEGACY REQUEST' : 'NEW REQUEST'}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 mb-6">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-otwGold shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">{req.pickupAddress || req.pickup}</p>
                                        <p className="text-xs text-white/40 mt-0.5">Pickup</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-white/40 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">{req.dropoffAddress || req.dropoff}</p>
                                        <p className="text-xs text-white/40 mt-0.5">Dropoff</p>
                                    </div>
                                </div>
                            </div>
                            
                            <form action={req.isLegacy ? acceptLegacyRequest : acceptRequest}>
                                <input type="hidden" name="requestId" value={req.id} />
                                <input type="hidden" name="driverId" value={driverProfile.id} />
                                <Button type="submit" variant="secondary" className="w-full h-10 border-white/10 hover:bg-white/10">
                                    Accept Job
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                ))}
                {availableRequests.length === 0 && availableLegacyRequests.length === 0 && (
                    <p className="text-muted-foreground col-span-full py-12 text-center border border-dashed border-border/40 bg-card/20 rounded-xl">
                        No jobs available right now.
                    </p>
                )}
            </div>
        </section>
      </div>
  );
}
