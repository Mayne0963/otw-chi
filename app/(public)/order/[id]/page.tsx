import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { ServiceType } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { ArrowUpRight, CheckCircle2, MapPin, ShieldAlert, User } from 'lucide-react';

type ReceiptItem = { name: string; quantity?: number; price?: number };

const formatCurrency = (value?: number | null) =>
  typeof value === 'number' ? `$${(value / 100).toFixed(2)}` : '—';

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
  const receiptItems: ReceiptItem[] = Array.isArray(order.receiptItems)
    ? (order.receiptItems as unknown as ReceiptItem[])
    : [];

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

      {order.serviceType === ServiceType.FOOD && (
        <Card className="bg-white/5 border-white/10 text-otwOffWhite">
          <CardHeader>
            <CardTitle>Food Pickup &amp; Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs text-white/50">Restaurant</div>
                <div className="text-sm font-medium">
                  {order.restaurantName || order.receiptVendor || 'Restaurant not provided'}
                </div>
                {order.receiptLocation && (
                  <div className="text-xs text-white/60">{order.receiptLocation}</div>
                )}
                {order.restaurantWebsite && (
                  <a
                    href={order.restaurantWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-otwGold inline-flex items-center gap-1"
                  >
                    Visit menu <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
              {typeof order.receiptAuthenticityScore === 'number' && (
                <Badge className="flex items-center gap-1 bg-green-900 text-green-200">
                  {order.receiptAuthenticityScore >= 0.65 ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  AI check {(order.receiptAuthenticityScore * 100).toFixed(0)}%
                </Badge>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-white/50 mb-2">Receipt items</div>
              {receiptItems.length > 0 ? (
                <div className="space-y-2">
                  {receiptItems.map((item, idx) => (
                    <div key={`${item.name}-${idx}`} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-white/70">{item.name}</span>
                        <span className="text-white/40">×{item.quantity || 1}</span>
                      </div>
                      <span className="text-otwGold">
                        {formatCurrency(typeof item.price === 'number' ? Math.round((item.price || 0) * 100) : null)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-white/10 pt-2 text-sm font-semibold">
                    <span className="text-white/70">Items total</span>
                    <span className="text-green-300">
                      {formatCurrency(
                        receiptItems.reduce(
                          (sum, item) =>
                            sum + Math.round((item.price || 0) * 100) * Math.max(1, item.quantity || 1),
                          0
                        )
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-white/60">Receipt upload pending.</div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-3">
              <div>
                <div className="text-xs text-white/50">Delivery fee</div>
                <div className="text-sm font-semibold">{formatCurrency(order.deliveryFeeCents)}</div>
              </div>
              <Badge className={order.deliveryFeePaid ? 'bg-green-900 text-green-200' : 'bg-orange-900 text-orange-100'}>
                {order.deliveryFeePaid ? 'Paid' : 'Awaiting payment'}
              </Badge>
            </div>

            {order.receiptImageData && (
              <div className="space-y-2">
                <div className="text-xs text-white/50">Receipt preview</div>
                <img
                  src={order.receiptImageData}
                  alt="Uploaded receipt"
                  className="w-full max-w-2xl rounded-lg border border-white/10 shadow-lg"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
