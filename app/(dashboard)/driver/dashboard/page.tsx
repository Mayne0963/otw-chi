import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DriverLiveMap from '@/components/otw/DriverLiveMap';
import { validateAddress } from '@/lib/geocoding';
import { revalidatePath } from 'next/cache';
import { RequestStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import type { OtwLocation } from '@/lib/otw/otwTypes';
import type { OtwDriverLocation } from '@/lib/otw/otwDriverLocation';

export default async function DriverDashboardPage() {
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
                    <CardTitle className="text-lg">Active Route Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <DriverLiveMap
                        driverId={driverProfile.id}
                        customer={customerLocation}
                        pickup={pickupLocation}
                        dropoff={dropoffLocation}
                        requestId={activeRequest?.id}
                        jobStatus={activeRequest?.status}
                        initialDriverLocation={driverLocations[0] ?? null}
                    />
                </CardContent>
            </Card>
        </section>
        
        {/* Active Jobs */}
        <section>
            <h2 className="text-2xl font-semibold mb-4 text-primary">My Active Jobs</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {assignedRequests.map((req: any) => (
                    <Card key={req.id} className="text-foreground">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>{req.serviceType}</span>
                                <Badge variant="outline">{req.status.replace('_', ' ')}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm mb-4">
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase tracking-[0.18em]">Pickup</span>
                                <span>{req.pickupAddress}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-xs uppercase tracking-[0.18em]">Dropoff</span>
                                <span>{req.dropoffAddress}</span>
                            </div>
                            {req.notes && (
                                <div className="bg-muted/40 p-2 rounded text-xs italic text-foreground/80">
                                    &quot;{req.notes}&quot;
                                </div>
                            )}
                            </div>
                            <div className="flex gap-2">
                                {req.status === 'ASSIGNED' && (
                                    <form action={updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value="PICKED_UP" />
                                        <Button type="submit" variant="secondary" className="w-full">Picked Up</Button>
                                    </form>
                                )}
                                {req.status === 'PICKED_UP' && (
                                    <form action={updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value="EN_ROUTE" />
                                        <Button type="submit" variant="secondary" className="w-full">En Route</Button>
                                    </form>
                                )}
                                {req.status === 'EN_ROUTE' && (
                                    <form action={updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value="DELIVERED" />   
                                        <Button type="submit" className="w-full">Delivered</Button>
                                    </form>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {assignedLegacyRequests.map((req: any) => (
                    <Card key={req.id} className="text-foreground">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>{req.serviceType}</span>
                                <Badge variant="outline">LEGACY {req.status.replace('_', ' ')}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm mb-4">
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase tracking-[0.18em]">Pickup</span>
                                    <span>{req.pickup}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase tracking-[0.18em]">Dropoff</span>
                                    <span>{req.dropoff}</span>
                                </div>
                                {req.notes && (
                                    <div className="bg-muted/40 p-2 rounded text-xs italic text-foreground/80">
                                        &quot;{req.notes}&quot;
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {req.status === RequestStatus.ASSIGNED && (
                                    <form action={updateLegacyStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value={RequestStatus.PICKED_UP} />
                                        <Button type="submit" variant="secondary" className="w-full">Picked Up</Button>
                                    </form>
                                )}
                                {req.status === RequestStatus.PICKED_UP && (
                                    <form action={updateLegacyStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value={RequestStatus.DELIVERED} />
                                        <Button type="submit" className="w-full">Delivered</Button>
                                    </form>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {assignedRequests.length === 0 && assignedLegacyRequests.length === 0 && (
                    <p className="text-muted-foreground col-span-full py-4 text-center border border-dashed border-border/70 rounded-lg">No active jobs.</p>
                )}
            </div>
        </section>

        {/* Available Jobs */}
        <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Available Jobs</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableRequests.map((req: any) => (
                    <Card key={req.id} className="text-foreground">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>{req.serviceType}</span>
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">Quote pending</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                {req.pickupAddress} <span className="text-otwGold">→</span> {req.dropoffAddress}
                            </p>
                            <form action={acceptRequest}>
                                <input type="hidden" name="requestId" value={req.id} />
                                <input type="hidden" name="driverId" value={driverProfile.id} />
                                <Button type="submit" variant="secondary" className="w-full">Accept Job</Button>
                            </form>
                        </CardContent>
                    </Card>
                ))}
                {availableLegacyRequests.map((req: any) => (
                    <Card key={req.id} className="text-foreground">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>{req.serviceType}</span>
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">Legacy</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                {req.pickup} <span className="text-otwGold">→</span> {req.dropoff}
                            </p>
                            <form action={acceptLegacyRequest}>
                                <input type="hidden" name="requestId" value={req.id} />
                                <input type="hidden" name="driverId" value={driverProfile.id} />
                                <Button type="submit" variant="secondary" className="w-full">Accept Job</Button>
                            </form>
                        </CardContent>
                    </Card>
                ))}
                {availableRequests.length === 0 && availableLegacyRequests.length === 0 && (
                    <p className="text-muted-foreground col-span-full py-4 text-center border border-dashed border-border/70 rounded-lg">No jobs available right now.</p>
                )}
            </div>
        </section>
      </div>
  );
}
