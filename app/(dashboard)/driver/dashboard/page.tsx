import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { revalidatePath } from 'next/cache';
import { RequestStatus } from '@prisma/client';
import { redirect } from 'next/navigation';

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
      status: { in: [RequestStatus.ASSIGNED, RequestStatus.PICKED_UP, RequestStatus.EN_ROUTE] },
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
    const newStatus = formData.get('status') as RequestStatus;

    if (!requestId || !newStatus) return;

    const prisma = getPrisma();
    await prisma.request.update({
      where: { id: requestId },
      data: { status: newStatus },
    });

    revalidatePath('/driver/dashboard');
  }

  return (
      <div className="space-y-8 p-6">
        <h1 className="text-3xl font-bold text-otwOffWhite">Driver Dashboard</h1>
        
        {/* Active Jobs */}
        <section>
            <h2 className="text-2xl font-semibold mb-4 text-otwGold">My Active Jobs</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {assignedRequests.map((req: any) => (
                    <Card key={req.id} className="bg-otwBlack/40 border-otwGold/50 text-otwOffWhite">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>{req.serviceType}</span>
                                <Badge variant="outline" className="border-otwGold text-otwGold">{req.status.replace('_', ' ')}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm mb-4">
                                <div>
                                    <span className="text-white/50 block text-xs">Pickup</span>
                                <span>{req.pickupAddress}</span>
                            </div>
                            <div>
                                <span className="text-white/50 block text-xs">Dropoff</span>
                                <span>{req.dropoffAddress}</span>
                            </div>
                            {req.notes && (
                                <div className="bg-white/5 p-2 rounded text-xs italic">
                                    &quot;{req.notes}&quot;
                                </div>
                            )}
                            </div>
                            <div className="flex gap-2">
                                {req.status === 'ASSIGNED' && (
                                    <form action={updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value="PICKED_UP" />
                                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Picked Up</Button>
                                    </form>
                                )}
                                {req.status === 'PICKED_UP' && (
                                    <form action={updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value="EN_ROUTE" />
                                        <Button type="submit" className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90">En Route</Button>
                                    </form>
                                )}
                                {req.status === 'EN_ROUTE' && (
                                    <form action={updateStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value="DELIVERED" />   
                                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Delivered</Button>
                                    </form>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {assignedLegacyRequests.map((req: any) => (
                    <Card key={req.id} className="bg-otwBlack/40 border-otwGold/50 text-otwOffWhite">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>{req.serviceType}</span>
                                <Badge variant="outline" className="border-otwGold text-otwGold">LEGACY {req.status.replace('_', ' ')}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm mb-4">
                                <div>
                                    <span className="text-white/50 block text-xs">Pickup</span>
                                    <span>{req.pickup}</span>
                                </div>
                                <div>
                                    <span className="text-white/50 block text-xs">Dropoff</span>
                                    <span>{req.dropoff}</span>
                                </div>
                                {req.notes && (
                                    <div className="bg-white/5 p-2 rounded text-xs italic">
                                        &quot;{req.notes}&quot;
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {req.status === RequestStatus.ASSIGNED && (
                                    <form action={updateLegacyStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value={RequestStatus.PICKED_UP} />
                                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Picked Up</Button>
                                    </form>
                                )}
                                {req.status === RequestStatus.PICKED_UP && (
                                    <form action={updateLegacyStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value={RequestStatus.EN_ROUTE} />
                                        <Button type="submit" className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90">En Route</Button>
                                    </form>
                                )}
                                {req.status === RequestStatus.EN_ROUTE && (
                                    <form action={updateLegacyStatus} className="w-full">
                                        <input type="hidden" name="requestId" value={req.id} />
                                        <input type="hidden" name="status" value={RequestStatus.DELIVERED} />
                                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Delivered</Button>
                                    </form>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {assignedRequests.length === 0 && assignedLegacyRequests.length === 0 && (
                    <p className="text-white/50 col-span-full py-4 text-center border border-dashed border-white/10 rounded-lg">No active jobs.</p>
                )}
            </div>
        </section>

        {/* Available Jobs */}
        <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">Available Jobs</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableRequests.map((req: any) => (
                    <Card key={req.id} className="bg-white/5 border-white/10 text-otwOffWhite hover:bg-white/10 transition-colors">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>{req.serviceType}</span>
                                <span className="text-xs uppercase tracking-wide text-white/60">Quote pending</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-white/60 mb-4">
                                {req.pickupAddress} <span className="text-otwGold">→</span> {req.dropoffAddress}
                            </p>
                            <form action={acceptRequest}>
                                <input type="hidden" name="requestId" value={req.id} />
                                <input type="hidden" name="driverId" value={driverProfile.id} />
                                <Button type="submit" variant="secondary" className="w-full hover:bg-otwGold hover:text-otwBlack">Accept Job</Button>
                            </form>
                        </CardContent>
                    </Card>
                ))}
                {availableLegacyRequests.map((req: any) => (
                    <Card key={req.id} className="bg-white/5 border-white/10 text-otwOffWhite hover:bg-white/10 transition-colors">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-center text-lg">
                                <span>{req.serviceType}</span>
                                <span className="text-xs uppercase tracking-wide text-white/60">Legacy</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-white/60 mb-4">
                                {req.pickup} <span className="text-otwGold">→</span> {req.dropoff}
                            </p>
                            <form action={acceptLegacyRequest}>
                                <input type="hidden" name="requestId" value={req.id} />
                                <input type="hidden" name="driverId" value={driverProfile.id} />
                                <Button type="submit" variant="secondary" className="w-full hover:bg-otwGold hover:text-otwBlack">Accept Job</Button>
                            </form>
                        </CardContent>
                    </Card>
                ))}
                {availableRequests.length === 0 && availableLegacyRequests.length === 0 && (
                    <p className="text-white/50 col-span-full py-4 text-center border border-dashed border-white/10 rounded-lg">No jobs available right now.</p>
                )}
            </div>
        </section>
      </div>
  );
}
