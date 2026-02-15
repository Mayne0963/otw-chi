import { redirect } from 'next/navigation';
import Image from 'next/image';
import { getCurrentUser } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import { ServiceType, DeliveryRequestStatus } from '@prisma/client';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { computeBillableReceiptSubtotalCents } from '@/lib/order-pricing';
import { ArrowUpRight, CheckCircle2, MapPin, ShieldAlert, User } from 'lucide-react';
import CancelOrderButton from '@/components/order/CancelOrderButton';

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
      <OtwPageShell>
        <OtwSectionHeader title="Order Not Found" subtitle="We could not find the order you requested." />
      </OtwPageShell>
    );
  }

  const isOwner = order.userId === user.id;
  const isAssignedDriver = order.assignedDriver?.userId === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAssignedDriver && !isAdmin) {
    return (
      <OtwPageShell>
        <OtwSectionHeader title="Access Denied" subtitle="You are not authorized to view this order." />
      </OtwPageShell>
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
  const billableReceiptSubtotalCents = computeBillableReceiptSubtotalCents({
    serviceType: order.serviceType,
    receiptSubtotalCents:
      typeof order.receiptSubtotalCents === 'number'
        ? order.receiptSubtotalCents
        : receiptItemsTotal,
    receiptItems,
    receiptImageData: order.receiptImageData,
    quoteBreakdown: order.quoteBreakdown,
  });
  const orderTotalCents =
    billableReceiptSubtotalCents + (order.deliveryFeeCents ?? 0) - (order.discountCents ?? 0);

  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Order Status" 
        subtitle={`Order ID ${order.id.slice(-6).toUpperCase()}`} 
      />

      <div className="mt-6 space-y-6">
        <Card>
          <div className="p-4 border-b border-white/10 mb-4 flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">Status</h3>
            <span className="bg-white/10 text-white px-2 py-0.5 rounded text-xs font-medium uppercase border border-white/10">
              {statusLabel}
            </span>
          </div>
          <div className="p-4 space-y-4 text-white">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-white/50">Service Type</div>
              <div className="text-base font-medium">{order.serviceType}</div>
            </div>
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/50">Pickup</div>
                <div className="text-sm font-medium">{order.pickupAddress}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/50">Dropoff</div>
                <div className="text-sm font-medium">{order.dropoffAddress}</div>
              </div>
              {order.notes && (
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/50">Notes</div>
                  <div className="text-sm text-white/80">{order.notes}</div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {order.serviceType === ServiceType.FOOD && (
          <Card>
            <div className="p-4 border-b border-white/10 mb-4">
              <h3 className="text-lg font-medium text-white">Food Pickup &amp; Receipt</h3>
            </div>
            <div className="p-4 space-y-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/50">Restaurant</div>
                  <div className="text-sm font-medium">
                    {order.restaurantName || order.receiptVendor || 'Restaurant not provided'}
                  </div>
                  {order.receiptLocation && (
                    <div className="text-xs text-white/50">{order.receiptLocation}</div>
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
                  <span className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-medium border border-green-500/20">
                    {order.receiptAuthenticityScore >= 0.65 ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                    AI check {(order.receiptAuthenticityScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-white/50 mb-2">Receipt items</div>
                {receiptItems.length > 0 ? (
                  <div className="space-y-2">
                    {receiptItems.map((item, idx) => (
                      <div key={`${item.name}-${idx}`} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-white/70">{item.name}</span>
                          <span className="text-white/50">×{item.quantity || 1}</span>
                        </div>
                        <span className="text-otwGold">
                          {formatCurrency(typeof item.price === 'number' ? Math.round((item.price || 0) * 100) : null)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-white/10 pt-2 text-sm font-semibold">
                      <span className="text-white/70">Items total</span>
                      <span className="text-otwGold">
                        {formatCurrency(receiptItemsTotal)}
                      </span>
                    </div>
                    <div className="text-xs text-white/50">
                      {billableReceiptSubtotalCents > 0
                        ? 'Included in charge for cash delivery.'
                        : 'Receipt items are logged for verification only.'}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-white/50">Receipt upload pending.</div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/50">Delivery fee</div>
                  <div className="text-sm font-semibold">{formatCurrency(order.deliveryFeeCents)}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${order.deliveryFeePaid ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {order.deliveryFeePaid ? 'Paid' : 'Awaiting payment'}
                </span>
              </div>

              {order.discountCents ? (
                <div className="flex items-center justify-between rounded-xl border border-otwGold/30 bg-otwGold/10 p-3">
                  <div>
                    <div className="text-xs text-otwGold/90">Coupon discount</div>
                    <div className="text-sm font-semibold text-otwGold">
                      -{formatCurrency(order.discountCents)}
                    </div>
                    {order.couponCode && (
                      <div className="text-xs text-otwGold/70">Code {order.couponCode}</div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/50">Order total</div>
                  <div className="text-sm font-semibold">{formatCurrency(orderTotalCents)}</div>
                </div>
              </div>

              {order.receiptImageData && (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/50">Receipt preview</div>
                  <Image
                    src={order.receiptImageData}
                    alt="Uploaded receipt"
                    width={1200}
                    height={900}
                    className="w-full max-w-2xl rounded-lg border border-white/10 shadow-otwSoft"
                    unoptimized
                  />
                </div>
              )}
            </div>
          </Card>
        )}

        <Card>
          <div className="p-4 border-b border-white/10 mb-4">
            <h3 className="text-lg font-medium text-white">Driver</h3>
          </div>
          <div className="p-4 space-y-2 text-white">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-otwGold" />
              <span>{order.assignedDriver ? driverName : 'Awaiting assignment'}</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 border-b border-white/10 mb-4">
            <h3 className="text-lg font-medium text-white">Live Tracking</h3>
          </div>
          <div className="p-4 space-y-2 text-white">
            {order.lastKnownLat && order.lastKnownLng ? (
              <div className="space-y-1 text-sm text-white/50">
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
              <div className="text-sm text-white/50">Waiting for driver location updates.</div>
            )}
          </div>
        </Card>

        {isOwner && (order.status === DeliveryRequestStatus.REQUESTED || order.status === DeliveryRequestStatus.ASSIGNED) && (
            <Card>
                <div className="p-4 border-b border-white/10 mb-4">
                    <h3 className="text-lg font-medium text-white">Actions</h3>
                </div>
                <div className="p-4">
                    <CancelOrderButton orderId={order.id} />
                </div>
            </Card>
        )}
      </div>
    </OtwPageShell>
  );
}
