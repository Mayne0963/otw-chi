import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { MapPin, User } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OrderStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  const prisma = getPrisma();
  const order = await prisma.deliveryRequest.findUnique({
    where: { id },
    include: {
      assignedDriver: {
        include: { user: true },
      },
    },
  });

  if (!order) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Order Not Found</h1>
        <p className="text-white/60">We could not find the order you requested.</p>
      </div>
    );
  }

  const isOwner = order.userId === user.id;
  const isAssignedDriver = order.assignedDriver?.userId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAssignedDriver && !isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Access Denied</h1>
        <p className="text-white/60">You are not authorized to view this order.</p>
      </div>
    );
  }

  const statusLabel = order.status.replace('_', ' ');
  const driverName = order.assignedDriver?.user?.name || 'Driver assigned';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Order Status</h1>
        <p className="text-white/60">Order ID {order.id.slice(-6).toUpperCase()}</p>
      </div>

      <Card className="bg-white/5 border-white/10 text-otwOffWhite">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Status</span>
            <Badge variant="secondary" className="bg-otwGold text-otwBlack">
              {statusLabel}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-white/50">Service Type</div>
            <div className="text-base font-medium">{order.serviceType}</div>
          </div>
          <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
            <div>
              <div className="text-xs text-white/50">Pickup</div>
              <div className="text-sm font-medium">{order.pickupAddress}</div>
            </div>
            <div>
              <div className="text-xs text-white/50">Dropoff</div>
              <div className="text-sm font-medium">{order.dropoffAddress}</div>
            </div>
            {order.notes && (
              <div>
                <div className="text-xs text-white/50">Notes</div>
                <div className="text-sm text-white/80">{order.notes}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 text-otwOffWhite">
        <CardHeader>
          <CardTitle>Driver</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-otwGold" />
            <span>{order.assignedDriver ? driverName : 'Awaiting assignment'}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 text-otwOffWhite">
        <CardHeader>
          <CardTitle>Live Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {order.lastKnownLat && order.lastKnownLng ? (
            <div className="space-y-1 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-otwGold" />
                <span>
                  {order.lastKnownLat.toFixed(4)}, {order.lastKnownLng.toFixed(4)}
                </span>
              </div>
              <div className="text-xs text-white/50">
                Last update {formatDate(order.lastKnownAt || new Date())}
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/60">Waiting for driver location updates.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
