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
      <div className="otw-container otw-section space-y-6">
        <h1 className="text-3xl font-semibold">Order Not Found</h1>
        <p className="text-muted-foreground">We could not find the order you requested.</p>
      </div>
    );
  }

  const isOwner = order.userId === user.id;
  const isAssignedDriver = order.assignedDriver?.userId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAssignedDriver && !isAdmin) {
    return (
      <div className="otw-container otw-section space-y-6">
        <h1 className="text-3xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground">You are not authorized to view this order.</p>
      </div>
    );
  }

  const statusLabel = order.status.replace('_', ' ');
  const driverName = order.assignedDriver?.user?.name || 'Driver assigned';
  const receiptItems: ReceiptItem[] = Array.isArray(order.receiptItems)
    ? (order.receiptItems as unknown as ReceiptItem[])
    : [];
  const receiptItemsTotal = receiptItems.reduce(
    (sum, item) => sum + Math.round((item.price || 0) * 100) * Math.max(1, item.quantity || 1),
    0
  );
  const orderTotalCents =
    receiptItemsTotal + (order.deliveryFeeCents ?? 0) - (order.discountCents ?? 0);

  return (
    <div className="otw-container otw-section space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Order Status</h1>
        <p className="text-muted-foreground">Order ID {order.id.slice(-6).toUpperCase()}</p>
      </div>

      <Card className="text-foreground">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Status</span>
            <Badge variant="secondary">{statusLabel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Service Type</div>
            <div className="text-base font-medium">{order.serviceType}</div>
          </div>
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/40 p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pickup</div>
              <div className="text-sm font-medium">{order.pickupAddress}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dropoff</div>
              <div className="text-sm font-medium">{order.dropoffAddress}</div>
            </div>
            {order.notes && (
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notes</div>
                <div className="text-sm text-foreground/80">{order.notes}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {order.serviceType === ServiceType.FOOD && (
        <Card className="text-foreground">
          <CardHeader>
            <CardTitle>Food Pickup &amp; Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Restaurant</div>
                <div className="text-sm font-medium">
                  {order.restaurantName || order.receiptVendor || 'Restaurant not provided'}
                </div>
                {order.receiptLocation && (
                  <div className="text-xs text-muted-foreground">{order.receiptLocation}</div>
                )}
                {order.restaurantWebsite && (
                  <a
                    href={order.restaurantWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-secondary inline-flex items-center gap-1"
                  >
                    Visit menu <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
              {typeof order.receiptAuthenticityScore === 'number' && (
                <Badge variant="success" className="flex items-center gap-1">
                  {order.receiptAuthenticityScore >= 0.65 ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  AI check {(order.receiptAuthenticityScore * 100).toFixed(0)}%
                </Badge>
              )}
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Receipt items</div>
              {receiptItems.length > 0 ? (
                <div className="space-y-2">
                  {receiptItems.map((item, idx) => (
                    <div key={`${item.name}-${idx}`} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground/70">{item.name}</span>
                        <span className="text-muted-foreground">×{item.quantity || 1}</span>
                      </div>
                      <span className="text-otwGold">
                        {formatCurrency(typeof item.price === 'number' ? Math.round((item.price || 0) * 100) : null)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-border/70 pt-2 text-sm font-semibold">
                    <span className="text-foreground/70">Items total</span>
                    <span className="text-green-300">
                      {formatCurrency(receiptItemsTotal)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Receipt upload pending.</div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 p-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Delivery fee</div>
                <div className="text-sm font-semibold">{formatCurrency(order.deliveryFeeCents)}</div>
              </div>
              <Badge variant={order.deliveryFeePaid ? 'success' : 'warning'}>
                {order.deliveryFeePaid ? 'Paid' : 'Awaiting payment'}
              </Badge>
            </div>

            {order.discountCents ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <div>
                  <div className="text-xs text-emerald-100">Coupon discount</div>
                  <div className="text-sm font-semibold text-emerald-200">
                    -{formatCurrency(order.discountCents)}
                  </div>
                  {order.couponCode && (
                    <div className="text-xs text-emerald-200/70">Code {order.couponCode}</div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 p-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Order total</div>
                <div className="text-sm font-semibold">{formatCurrency(orderTotalCents)}</div>
              </div>
            </div>

            {order.receiptImageData && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Receipt preview</div>
                <img
                  src={order.receiptImageData}
                  alt="Uploaded receipt"
                  className="w-full max-w-2xl rounded-lg border border-border/70 shadow-otwSoft"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="text-foreground">
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

      <Card className="text-foreground">
        <CardHeader>
          <CardTitle>Live Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {order.lastKnownLat && order.lastKnownLng ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-otwGold" />
                <span>
                  {order.lastKnownLat.toFixed(4)}, {order.lastKnownLng.toFixed(4)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Last update {formatDate(order.lastKnownAt || new Date())}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Waiting for driver location updates.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
